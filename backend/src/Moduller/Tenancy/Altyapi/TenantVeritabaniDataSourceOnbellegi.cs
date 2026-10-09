using System.Diagnostics.Metrics;
using Npgsql;

namespace TupBayiProje.Moduller.Tenancy.Altyapi;

// INV-TEN-003/004: bu sinif yalniz server-side cozulmus tenant kimligi ve baglanti metadata'si ile cagrilir.
public sealed class TenantVeritabaniDataSourceOnbellegi : IAsyncDisposable
{
    public const string MeterAdi = "TupBayiProje.Tenancy.DataSourceOnbellegi";

    private readonly TenantVeritabaniDataSourceOnbellegiSecenekleri _secenekler;
    private readonly Dictionary<Guid, Kayit> _kayitlar = [];
    private readonly HashSet<Kayit> _disposeBekleyenKayitlar = [];
    private readonly SemaphoreSlim _kilit = new(1, 1);
    private readonly CancellationTokenSource _kapatma = new();
    private readonly Meter _meter = new(MeterAdi);
    private readonly Counter<long> _isabet;
    private readonly Counter<long> _isabetsizlik;
    private readonly Counter<long> _tahliye;
    private readonly Counter<long> _olusturma;
    private readonly Counter<long> _dispose;
    private readonly Counter<long> _baglantiHatasi;
    private readonly UpDownCounter<long> _aktif;
    private readonly Task _temizlemeGorevi;
    private readonly TaskCompletionSource _kapatmaTamamlandi =
        new(TaskCreationOptions.RunContinuationsAsynchronously);
    private TaskCompletionSource? _tumKayitlarBirakildi;
    private int _aktifDataSourceSayisi;
    private int _onbellektekiDataSourceSayisi;
    private int _bekleyenDisposeSayisi;
    private int _disposeBaslatildi;
    private bool _kapatiliyor;

    public TenantVeritabaniDataSourceOnbellegi(TenantVeritabaniDataSourceOnbellegiSecenekleri secenekler)
    {
        ArgumentNullException.ThrowIfNull(secenekler);
        _secenekler = secenekler;
        _isabet = _meter.CreateCounter<long>("tbp.tenancy.datasource.cache.hit");
        _isabetsizlik = _meter.CreateCounter<long>("tbp.tenancy.datasource.cache.miss");
        _tahliye = _meter.CreateCounter<long>("tbp.tenancy.datasource.eviction");
        _olusturma = _meter.CreateCounter<long>("tbp.tenancy.datasource.create");
        _dispose = _meter.CreateCounter<long>("tbp.tenancy.datasource.dispose");
        _baglantiHatasi = _meter.CreateCounter<long>("tbp.tenancy.datasource.connection.error");
        _aktif = _meter.CreateUpDownCounter<long>("tbp.tenancy.datasource.active");
        _temizlemeGorevi = PeriyodikTemizleAsync();
    }

    public int AktifDataSourceSayisi => Volatile.Read(ref _aktifDataSourceSayisi);

    public int OnbellektekiDataSourceSayisi => Volatile.Read(ref _onbellektekiDataSourceSayisi);

    public async ValueTask<TenantVeritabaniDataSourceKiralama> KiralaAsync(
        Guid tenantId,
        string baglantiDizesi,
        CancellationToken cancellationToken = default)
    {
        if (tenantId == Guid.Empty)
        {
            throw new ArgumentException("Tenant kimligi bos olamaz.", nameof(tenantId));
        }

        ArgumentException.ThrowIfNullOrWhiteSpace(baglantiDizesi);

        Kayit kayit;
        List<Kayit> tahliyeEdilenler = [];
        await _kilit.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            ObjectDisposedException.ThrowIf(_kapatiliyor, this);
            var simdi = DateTimeOffset.UtcNow;

            if (_kayitlar.TryGetValue(tenantId, out kayit!) &&
                KayitKiralanabilir(kayit, baglantiDizesi, simdi, tahliyeEdilenler))
            {
                kayit.KiralamaSayisi++;
                kayit.SonErisim = simdi;
                _isabet.Add(1);
            }
            else
            {
                SuresiDolanBosKayitlariAyir(simdi, tahliyeEdilenler);
                KapasiteIcinYerAc(tahliyeEdilenler);
                kayit = new Kayit(tenantId, baglantiDizesi, simdi) { KiralamaSayisi = 1 };
                _kayitlar.Add(tenantId, kayit);
                Volatile.Write(ref _onbellektekiDataSourceSayisi, _kayitlar.Count);
                var onceDisposeEdilecekler = tahliyeEdilenler.ToArray();
                var onceTamamlanacakDisposelar = _disposeBekleyenKayitlar
                    .Select(disposeBekleyen => disposeBekleyen.DisposeTamamlandi.Task)
                    .ToArray();
                tahliyeEdilenler.Clear();
                kayit.OlusturmaGorevi = OncekiKayitlariDisposeEdipDataSourceOlusturAsync(
                    kayit,
                    onceDisposeEdilecekler,
                    onceTamamlanacakDisposelar);
                _isabetsizlik.Add(1);
            }
        }
        finally
        {
            _kilit.Release();
        }

        await KayitlariDisposeEtAsync(tahliyeEdilenler).ConfigureAwait(false);

        try
        {
            var dataSource = await kayit.OlusturmaGorevi.WaitAsync(cancellationToken).ConfigureAwait(false);
            return new TenantVeritabaniDataSourceKiralama(this, kayit, dataSource);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            await GeriBirakAsync(kayit).ConfigureAwait(false);
            throw;
        }
    }

    public async Task BosKayitlariTemizleAsync(CancellationToken cancellationToken = default)
    {
        List<Kayit> tahliyeEdilenler = [];
        await _kilit.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            SuresiDolanBosKayitlariAyir(DateTimeOffset.UtcNow, tahliyeEdilenler);
        }
        finally
        {
            _kilit.Release();
        }

        await KayitlariDisposeEtAsync(tahliyeEdilenler).ConfigureAwait(false);
    }

    internal async ValueTask GeriBirakAsync(Kayit kayit)
    {
        Kayit? disposeEdilecek = null;
        await _kilit.WaitAsync().ConfigureAwait(false);
        try
        {
            if (kayit.KiralamaSayisi > 0)
            {
                kayit.KiralamaSayisi--;
            }

            if (kayit.KiralamaSayisi == 0)
            {
                kayit.BosKalmaBaslangici = DateTimeOffset.UtcNow;
                if (_kapatiliyor || kayit.SuresiDoldu)
                {
                    disposeEdilecek = KaydiDisposeIcinAyir(kayit, tahliye: kayit.SuresiDoldu);
                }
            }
        }
        finally
        {
            _kilit.Release();
        }

        if (disposeEdilecek is not null)
        {
            await DataSourceDisposeEtAsync(disposeEdilecek).ConfigureAwait(false);
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (Interlocked.CompareExchange(ref _disposeBaslatildi, 1, 0) == 0)
        {
            try
            {
                await KapatAsync().ConfigureAwait(false);
                _kapatmaTamamlandi.TrySetResult();
            }
            catch (Exception hata)
            {
                _kapatmaTamamlandi.TrySetException(hata);
                throw;
            }
        }
        else
        {
            await _kapatmaTamamlandi.Task.ConfigureAwait(false);
        }

        GC.SuppressFinalize(this);
    }

    private async Task KapatAsync()
    {
        List<Kayit> disposeEdilecekler = [];
        Task? bekleme = null;
        await _kilit.WaitAsync().ConfigureAwait(false);
        try
        {
            _kapatiliyor = true;
            _kapatma.Cancel();
            foreach (var kayit in _kayitlar.Values.Where(kayit => kayit.KiralamaSayisi == 0).ToArray())
            {
                var ayrilan = KaydiDisposeIcinAyir(kayit, tahliye: false);
                if (ayrilan is not null)
                {
                    disposeEdilecekler.Add(ayrilan);
                }
            }

            if (_kayitlar.Count > 0 || _bekleyenDisposeSayisi > 0)
            {
                _tumKayitlarBirakildi = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
                bekleme = _tumKayitlarBirakildi.Task;
            }
        }
        finally
        {
            _kilit.Release();
        }

        await KayitlariDisposeEtAsync(disposeEdilecekler).ConfigureAwait(false);
        if (bekleme is not null)
        {
            await bekleme.ConfigureAwait(false);
        }

        await _temizlemeGorevi.ConfigureAwait(false);
        _kapatma.Dispose();
        _kilit.Dispose();
        _meter.Dispose();
    }

    private async Task<NpgsqlDataSource> DataSourceOlusturAsync(Kayit kayit)
    {
        NpgsqlDataSource? dataSource = null;
        using var zamanAsimi = new CancellationTokenSource(_secenekler.BaglantiDogrulamaZamanAsimi);
        using var bagliIptal = CancellationTokenSource.CreateLinkedTokenSource(zamanAsimi.Token, _kapatma.Token);
        try
        {
            dataSource = new NpgsqlDataSourceBuilder(kayit.BaglantiDizesi).Build();
            await using (var baglanti = await dataSource.OpenConnectionAsync(bagliIptal.Token).ConfigureAwait(false))
            {
            }

            Interlocked.Increment(ref _aktifDataSourceSayisi);
            _aktif.Add(1);
            _olusturma.Add(1);
            return dataSource;
        }
        catch (OperationCanceledException) when (_kapatma.IsCancellationRequested)
        {
            if (dataSource is not null)
            {
                await dataSource.DisposeAsync().ConfigureAwait(false);
            }

            await BasarisizOlusturmayiKaldirAsync(kayit).ConfigureAwait(false);
            throw;
        }
        catch
        {
            _baglantiHatasi.Add(1);
            if (dataSource is not null)
            {
                await dataSource.DisposeAsync().ConfigureAwait(false);
            }

            await BasarisizOlusturmayiKaldirAsync(kayit).ConfigureAwait(false);
            throw;
        }
    }

    private async Task<NpgsqlDataSource> OncekiKayitlariDisposeEdipDataSourceOlusturAsync(
        Kayit kayit,
        IReadOnlyCollection<Kayit> onceDisposeEdilecekler,
        IReadOnlyCollection<Task> onceTamamlanacakDisposelar)
    {
        await KayitlariDisposeEtAsync(onceDisposeEdilecekler).ConfigureAwait(false);
        await Task.WhenAll(onceTamamlanacakDisposelar).ConfigureAwait(false);
        return await DataSourceOlusturAsync(kayit).ConfigureAwait(false);
    }

    private void SuresiDolanBosKayitlariAyir(DateTimeOffset simdi, List<Kayit> ayrilanlar)
    {
        foreach (var kayit in _kayitlar.Values.ToArray())
        {
            var yasamSuresiDoldu = simdi - kayit.OlusturulmaZamani >= _secenekler.YasamSuresi;
            var bosKalmaSuresiDoldu = kayit.KiralamaSayisi == 0 &&
                simdi - kayit.BosKalmaBaslangici >= _secenekler.BosKalmaSuresi;
            if (!yasamSuresiDoldu && !bosKalmaSuresiDoldu)
            {
                continue;
            }

            if (kayit.KiralamaSayisi == 0)
            {
                var ayrilan = KaydiDisposeIcinAyir(kayit, tahliye: true);
                if (ayrilan is not null)
                {
                    ayrilanlar.Add(ayrilan);
                }
            }
            else
            {
                // Mutlak TTL dolmustur; aktif lease bitene kadar dispose ertelenir.
                kayit.SuresiDoldu = true;
            }
        }
    }

    private bool KayitKiralanabilir(
        Kayit kayit,
        string baglantiDizesi,
        DateTimeOffset simdi,
        List<Kayit> ayrilanlar)
    {
        var yasamSuresiDoldu = simdi - kayit.OlusturulmaZamani >= _secenekler.YasamSuresi;
        var bosKalmaSuresiDoldu = kayit.KiralamaSayisi == 0 &&
            simdi - kayit.BosKalmaBaslangici >= _secenekler.BosKalmaSuresi;
        var metadataDegisti = !string.Equals(kayit.BaglantiDizesi, baglantiDizesi, StringComparison.Ordinal);
        if (!yasamSuresiDoldu && !bosKalmaSuresiDoldu && !metadataDegisti)
        {
            return true;
        }

        if (kayit.KiralamaSayisi > 0)
        {
            kayit.SuresiDoldu = true;
            throw new InvalidOperationException(
                "Tenant data source kaydinin yenilenmesi icin aktif kiralamalarin tamamlanmasi bekleniyor.");
        }

        var ayrilan = KaydiDisposeIcinAyir(kayit, tahliye: true);
        if (ayrilan is not null)
        {
            ayrilanlar.Add(ayrilan);
        }

        return false;
    }

    private void KapasiteIcinYerAc(List<Kayit> ayrilanlar)
    {
        while (_kayitlar.Count >= _secenekler.Kapasite)
        {
            var aday = _kayitlar.Values
                .Where(kayit => kayit.KiralamaSayisi == 0)
                .MinBy(kayit => kayit.BosKalmaBaslangici > kayit.SonErisim
                    ? kayit.BosKalmaBaslangici
                    : kayit.SonErisim);
            if (aday is null)
            {
                throw new InvalidOperationException("Data source onbellegi dolu ve tum kayitlar kullanimda.");
            }

            var ayrilan = KaydiDisposeIcinAyir(aday, tahliye: true);
            if (ayrilan is not null)
            {
                ayrilanlar.Add(ayrilan);
            }
        }
    }

    private Kayit? KaydiDisposeIcinAyir(Kayit kayit, bool tahliye)
    {
        if (!_kayitlar.TryGetValue(kayit.TenantId, out var bulunan) || !ReferenceEquals(bulunan, kayit))
        {
            return null;
        }

        _kayitlar.Remove(kayit.TenantId);
        _disposeBekleyenKayitlar.Add(kayit);
        _bekleyenDisposeSayisi++;
        Volatile.Write(ref _onbellektekiDataSourceSayisi, _kayitlar.Count);
        if (tahliye)
        {
            _tahliye.Add(1);
        }

        return kayit;
    }

    private async Task BasarisizOlusturmayiKaldirAsync(Kayit kayit)
    {
        await _kilit.WaitAsync().ConfigureAwait(false);
        try
        {
            if (_kayitlar.TryGetValue(kayit.TenantId, out var bulunan) && ReferenceEquals(bulunan, kayit))
            {
                _kayitlar.Remove(kayit.TenantId);
                Volatile.Write(ref _onbellektekiDataSourceSayisi, _kayitlar.Count);
            }

            TumKayitlarBirakildiSinyaliniGuncelle();
        }
        finally
        {
            _kilit.Release();
        }
    }

    private async Task KayitlariDisposeEtAsync(IEnumerable<Kayit> kayitlar)
    {
        foreach (var kayit in kayitlar)
        {
            await DataSourceDisposeEtAsync(kayit).ConfigureAwait(false);
        }
    }

    private async Task DataSourceDisposeEtAsync(Kayit kayit)
    {
        if (Interlocked.Exchange(ref kayit.DisposeBasladi, 1) != 0)
        {
            return;
        }

        NpgsqlDataSource? dataSource = null;
        try
        {
            dataSource = await kayit.OlusturmaGorevi.ConfigureAwait(false);
            await dataSource.DisposeAsync().ConfigureAwait(false);
        }
        catch
        {
            // Basarisiz olusturmada factory olusturdugu data source'u kendisi dispose eder.
        }
        finally
        {
            if (dataSource is not null)
            {
                Interlocked.Decrement(ref _aktifDataSourceSayisi);
                _aktif.Add(-1);
                _dispose.Add(1);
            }

            await DisposeTamamlandiAsync(kayit).ConfigureAwait(false);
        }
    }

    private async Task PeriyodikTemizleAsync()
    {
        try
        {
            while (true)
            {
                await Task.Delay(_secenekler.TemizlemeAraligi, _kapatma.Token).ConfigureAwait(false);
                await BosKayitlariTemizleAsync(_kapatma.Token).ConfigureAwait(false);
            }
        }
        catch (OperationCanceledException) when (_kapatma.IsCancellationRequested)
        {
        }
    }

    private void TumKayitlarBirakildiSinyaliniGuncelle()
    {
        if (_kapatiliyor && _kayitlar.Count == 0 && _bekleyenDisposeSayisi == 0)
        {
            _tumKayitlarBirakildi?.TrySetResult();
        }
    }

    private async Task DisposeTamamlandiAsync(Kayit kayit)
    {
        await _kilit.WaitAsync().ConfigureAwait(false);
        try
        {
            _disposeBekleyenKayitlar.Remove(kayit);
            _bekleyenDisposeSayisi--;
            kayit.DisposeTamamlandi.TrySetResult();
            TumKayitlarBirakildiSinyaliniGuncelle();
        }
        finally
        {
            _kilit.Release();
        }
    }

    internal sealed class Kayit(Guid tenantId, string baglantiDizesi, DateTimeOffset sonErisim)
    {
        public Guid TenantId { get; } = tenantId;

        public string BaglantiDizesi { get; } = baglantiDizesi;

        public DateTimeOffset SonErisim { get; set; } = sonErisim;

        public DateTimeOffset OlusturulmaZamani { get; } = sonErisim;

        public DateTimeOffset BosKalmaBaslangici { get; set; } = sonErisim;

        public Task<NpgsqlDataSource> OlusturmaGorevi { get; set; } = null!;

        public int KiralamaSayisi { get; set; }

        public bool SuresiDoldu { get; set; }

        public int DisposeBasladi;

        public TaskCompletionSource DisposeTamamlandi { get; } =
            new(TaskCreationOptions.RunContinuationsAsynchronously);
    }
}
