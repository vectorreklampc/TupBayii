using System.Diagnostics;
using System.Transactions;
using Npgsql;
using NpgsqlTypes;

namespace TupBayiProje.Moduller.Audit.Altyapi;

public enum DenetimYazmaSonucu
{
    Kalici,
    Tekrar,
    Catisma,
    BelirsizGuvenliHata,
}

internal sealed class DenetimYaziciTestKancalari
{
    internal TimeSpan? TestButcesi { get; init; }

    internal Func<CancellationToken, Task>? CommitBasladi { get; init; }

    internal Func<CancellationToken, Task>? CommitSonrasi { get; init; }

    internal Func<CancellationToken, Task>? ReconciliationBasladi { get; init; }

    internal Func<DenetimTemizlikAdimi, Task>? TemizlikAdimiBasliyor { get; init; }

    internal Action<DenetimTemizlikAdimi>? TemizlikAdimiBitti { get; init; }
}

internal enum DenetimTemizlikAdimi
{
    Rollback,
    TransactionDispose,
    BaglantiDispose,
}

internal sealed class DenetimYazici
{
    private static readonly TimeSpan VarsayilanButce = TimeSpan.FromSeconds(12);
    private readonly string _baglantiDizesi;
    private readonly TimeSpan _butce;
    private readonly DenetimYaziciTestKancalari? _testKancalari;

    internal DenetimYazici(string baglantiDizesi)
        : this(baglantiDizesi, null)
    {
    }

    internal DenetimYazici(
        string baglantiDizesi,
        DenetimYaziciTestKancalari? testKancalari)
    {
        var gelen = new NpgsqlConnectionStringBuilder(baglantiDizesi);
        var olusturucu = new NpgsqlConnectionStringBuilder(baglantiDizesi)
        {
            Enlist = false,
            IncludeErrorDetail = false,
            // Close fiziksel baglantiyi bitirir; commit edilmemis transaction sunucuda geri alinir.
            Pooling = false,
            // Iptal aninda baglanti kirilir; Npgsql cancel yaniti icin deadline disinda beklemez.
            CancellationTimeout = -1,
            Timeout = IkincilTavan(gelen.Timeout),
            CommandTimeout = IkincilTavan(gelen.CommandTimeout),
        };
        if (!string.Equals(olusturucu.Username, "audit_runtime", StringComparison.Ordinal))
        {
            throw new ArgumentException("Audit runtime kimligi gecersiz.", nameof(baglantiDizesi));
        }

        _baglantiDizesi = olusturucu.ConnectionString;
        _testKancalari = testKancalari;
        _butce = testKancalari?.TestButcesi ?? VarsayilanButce;
        if (_butce <= TimeSpan.Zero || _butce > VarsayilanButce)
        {
            throw new ArgumentOutOfRangeException(nameof(testKancalari));
        }
    }

    // Yalniz ayar dogrulamasi icindir; baglanti dizesi test ciktisina yazilmaz.
    internal NpgsqlConnectionStringBuilder TestBaglantiAyarlari => new(_baglantiDizesi);

    private static int IkincilTavan(int yapilandirilmisSaniye) =>
        yapilandirilmisSaniye <= 0 ? 5 : Math.Min(5, yapilandirilmisSaniye);

    internal async Task<DenetimYazmaSonucu> YazAsync(
        DenetimKarari karar,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(karar);
        using var deadline = new MonotonicDeadline(_butce, cancellationToken);
        using var ortamBastirma = new TransactionScope(
            TransactionScopeOption.Suppress,
            TransactionScopeAsyncFlowOption.Enabled);

        NpgsqlConnection? baglanti = null;
        NpgsqlTransaction? transaction = null;
        var commitTamamlandi = false;
        var uzlastirilmali = false;
        var sonuc = DenetimYazmaSonucu.BelirsizGuvenliHata;
        try
        {
            baglanti = new NpgsqlConnection(_baglantiDizesi);
            await baglanti.OpenAsync(deadline.Token);
            transaction = await baglanti.BeginTransactionAsync(
                System.Data.IsolationLevel.ReadCommitted,
                deadline.Token);
            await KaydiEkleAsync(baglanti, transaction, karar, deadline);

            // Bu noktadan sonraki her kesinti ambiguous'tur.
            uzlastirilmali = true;
            if (_testKancalari?.CommitBasladi is not null)
            {
                await _testKancalari.CommitBasladi(deadline.Token);
            }

            await transaction.CommitAsync(deadline.Token);
            commitTamamlandi = true;
            if (_testKancalari?.CommitSonrasi is not null)
            {
                await _testKancalari.CommitSonrasi(deadline.Token);
            }

            sonuc = DenetimYazmaSonucu.Kalici;
        }
        catch (PostgresException hata) when (hata.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            uzlastirilmali = true;
        }
        catch
        {
            // Hata ayrintisi yukariya veya telemetry'ye tasinmaz; sonuc fail-closed kalir.
        }
        finally
        {
            await TemizligiBekleAsync(baglanti, transaction, commitTamamlandi, deadline.Token);
        }

        if (sonuc == DenetimYazmaSonucu.Kalici)
        {
            return deadline.Aktif
                ? DenetimYazmaSonucu.Kalici
                : DenetimYazmaSonucu.BelirsizGuvenliHata;
        }

        if (!uzlastirilmali || !deadline.Aktif)
        {
            return DenetimYazmaSonucu.BelirsizGuvenliHata;
        }

        return await UzlastirAsync(karar, deadline);
    }

    private static async Task KaydiEkleAsync(
        NpgsqlConnection baglanti,
        NpgsqlTransaction transaction,
        DenetimKarari karar,
        MonotonicDeadline deadline)
    {
        const string sql = """
            INSERT INTO master.denetim_kaydi
                (id, karar_id, tenant_id, correlation_id, islem, sonuc, gerekce_kodu)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            """;
        await using var komut = new NpgsqlCommand(sql, baglanti, transaction)
        {
            CommandTimeout = deadline.KomutZamanAsimiSaniyesi,
        };
        komut.Parameters.AddWithValue(Guid.CreateVersion7());
        komut.Parameters.AddWithValue(karar.KararKimligi.Deger);
        komut.Parameters.AddWithValue(karar.TenantBaglami.TenantId);
        komut.Parameters.AddWithValue(karar.CorrelationKimligi.Deger);
        komut.Parameters.AddWithValue(karar.Islem);
        komut.Parameters.AddWithValue(karar.Sonuc);
        komut.Parameters.Add(new NpgsqlParameter
        {
            NpgsqlDbType = NpgsqlDbType.Varchar,
            Value = karar.GerekceKodu is null ? DBNull.Value : karar.GerekceKodu,
        });
        await komut.ExecuteNonQueryAsync(deadline.Token);
    }

    private async Task<DenetimYazmaSonucu> UzlastirAsync(
        DenetimKarari karar,
        MonotonicDeadline deadline)
    {
        NpgsqlConnection? baglanti = null;
        DenetimYazmaSonucu sonuc = DenetimYazmaSonucu.BelirsizGuvenliHata;
        try
        {
            if (_testKancalari?.ReconciliationBasladi is not null)
            {
                await _testKancalari.ReconciliationBasladi(deadline.Token);
            }

            baglanti = new NpgsqlConnection(_baglantiDizesi);
            await baglanti.OpenAsync(deadline.Token);
            const string sql = """
                SELECT servis_kimligi, tenant_id, correlation_id, islem, sonuc, gerekce_kodu
                FROM master.denetim_kaydi
                WHERE karar_id = $1
                """;
            await using var komut = new NpgsqlCommand(sql, baglanti)
            {
                CommandTimeout = deadline.KomutZamanAsimiSaniyesi,
            };
            komut.Parameters.AddWithValue(karar.KararKimligi.Deger);
            await using var okuyucu = await komut.ExecuteReaderAsync(deadline.Token);
            if (await okuyucu.ReadAsync(deadline.Token))
            {
                var ayni =
                    okuyucu.GetString(0) == "audit_runtime" &&
                    okuyucu.GetGuid(1) == karar.TenantBaglami.TenantId &&
                    okuyucu.GetGuid(2) == karar.CorrelationKimligi.Deger &&
                    okuyucu.GetString(3) == karar.Islem &&
                    okuyucu.GetString(4) == karar.Sonuc &&
                    (okuyucu.IsDBNull(5) ? null : okuyucu.GetString(5)) == karar.GerekceKodu;
                sonuc = ayni ? DenetimYazmaSonucu.Tekrar : DenetimYazmaSonucu.Catisma;
            }
        }
        catch
        {
            sonuc = DenetimYazmaSonucu.BelirsizGuvenliHata;
        }
        finally
        {
            await TemizligiBekleAsync(baglanti, null, false, deadline.Token);
        }

        return deadline.Aktif ? sonuc : DenetimYazmaSonucu.BelirsizGuvenliHata;
    }

    // Tek sirali cleanup zinciri yalniz bir kez deadline ile beklenir. Deadline dolarsa caller
    // fail-closed devam eder; zincir arka planda kendi sirasiyla biter ve ayni baglantida ikinci
    // operasyon baslatilmaz.
    private async Task TemizligiBekleAsync(
        NpgsqlConnection? baglanti,
        NpgsqlTransaction? transaction,
        bool transactionTamamlandi,
        CancellationToken deadlineToken)
    {
        var zincir = TemizleAsync(baglanti, transaction, transactionTamamlandi, deadlineToken);
        try
        {
            await zincir.WaitAsync(deadlineToken);
        }
        catch
        {
            // AdimAsync hatalari yuttugu icin zincir fault beklenmez; yine de nihai istisna gozlenir.
            _ = zincir.ContinueWith(
                static g => _ = g.Exception,
                CancellationToken.None,
                TaskContinuationOptions.OnlyOnFaulted | TaskContinuationOptions.ExecuteSynchronously,
                TaskScheduler.Default);
        }
    }

    // NpgsqlConnection thread-safe degildir: her adim bir oncekinin bitmesini bekler.
    private async Task TemizleAsync(
        NpgsqlConnection? baglanti,
        NpgsqlTransaction? transaction,
        bool transactionTamamlandi,
        CancellationToken deadlineToken)
    {
        if (transaction is not null)
        {
            if (!transactionTamamlandi)
            {
                transactionTamamlandi = await AdimAsync(
                    DenetimTemizlikAdimi.Rollback,
                    () => transaction.RollbackAsync(deadlineToken));
            }

            // Tamamlanmamis transaction'in DisposeAsync'i tokensiz rollback I/O'su yapar; bu durumda
            // atlanir ve non-pooled baglantinin kapanmasi sunucu tarafinda rollback'i garanti eder.
            if (transactionTamamlandi)
            {
                await AdimAsync(
                    DenetimTemizlikAdimi.TransactionDispose,
                    () => transaction.DisposeAsync().AsTask());
            }
        }

        if (baglanti is not null)
        {
            await AdimAsync(
                DenetimTemizlikAdimi.BaglantiDispose,
                () => baglanti.DisposeAsync().AsTask());
        }
    }

    // Hicbir hata disari cikmaz: zincirin task'i fault olmaz, arka planda kalsa da gozlemsiz istisna uretmez.
    private async Task<bool> AdimAsync(DenetimTemizlikAdimi adim, Func<Task> islem)
    {
        var basarili = false;
        try
        {
            if (_testKancalari?.TemizlikAdimiBasliyor is not null)
            {
                await _testKancalari.TemizlikAdimiBasliyor(adim);
            }

            await islem();
            basarili = true;
        }
        catch
        {
            // Cleanup basariya cevrilmez; asil sonuc fail-closed kalir.
        }

        try
        {
            _testKancalari?.TemizlikAdimiBitti?.Invoke(adim);
        }
        catch
        {
            // Yalniz test gozlemcisidir; cleanup sirasini etkilemez.
        }

        return basarili;
    }

    private sealed class MonotonicDeadline : IDisposable
    {
        private readonly TimeSpan _butce;
        private readonly long _baslangic = Stopwatch.GetTimestamp();
        private readonly CancellationTokenSource _deadline;

        internal MonotonicDeadline(TimeSpan butce, CancellationToken disToken)
        {
            _butce = butce;
            _deadline = CancellationTokenSource.CreateLinkedTokenSource(disToken);
            _deadline.CancelAfter(butce);
        }

        internal CancellationToken Token => _deadline.Token;

        internal bool Aktif =>
            !_deadline.IsCancellationRequested && Stopwatch.GetElapsedTime(_baslangic) < _butce;

        internal int KomutZamanAsimiSaniyesi
        {
            get
            {
                var kalan = _butce - Stopwatch.GetElapsedTime(_baslangic);
                return Math.Max(1, Math.Min(5, (int)Math.Ceiling(kalan.TotalSeconds)));
            }
        }

        public void Dispose() => _deadline.Dispose();
    }
}
