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
            if (transaction is not null && !commitTamamlandi)
            {
                await FazHatasiniYutAsync(() => transaction.RollbackAsync(deadline.Token));
            }

            if (transaction is not null)
            {
                await FazHatasiniYutAsync(
                    () => transaction.DisposeAsync().AsTask().WaitAsync(deadline.Token));
            }

            if (baglanti is not null)
            {
                await FazHatasiniYutAsync(() => baglanti.CloseAsync().WaitAsync(deadline.Token));
                await FazHatasiniYutAsync(
                    () => baglanti.DisposeAsync().AsTask().WaitAsync(deadline.Token));
            }
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
            if (baglanti is not null)
            {
                await FazHatasiniYutAsync(() => baglanti.CloseAsync().WaitAsync(deadline.Token));
                await FazHatasiniYutAsync(
                    () => baglanti.DisposeAsync().AsTask().WaitAsync(deadline.Token));
            }
        }

        return deadline.Aktif ? sonuc : DenetimYazmaSonucu.BelirsizGuvenliHata;
    }

    private static async Task FazHatasiniYutAsync(Func<Task> faz)
    {
        try
        {
            await faz();
        }
        catch
        {
            // Cleanup basariya cevrilmez; asil sonuc fail-closed kalir.
        }
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
