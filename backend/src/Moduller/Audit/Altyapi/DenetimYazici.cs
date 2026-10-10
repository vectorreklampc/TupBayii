using System.Data;
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

internal sealed class DenetimYazici
{
    private readonly string _baglantiDizesi;

    internal DenetimYazici(string baglantiDizesi)
    {
        var olusturucu = new NpgsqlConnectionStringBuilder(baglantiDizesi)
        {
            Enlist = false,
            IncludeErrorDetail = false,
        };
        if (!string.Equals(olusturucu.Username, "audit_runtime", StringComparison.Ordinal))
        {
            throw new ArgumentException("Audit runtime kimligi gecersiz.", nameof(baglantiDizesi));
        }

        _baglantiDizesi = olusturucu.ConnectionString;
    }

    internal async Task<DenetimYazmaSonucu> YazAsync(
        DenetimKarari karar,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(karar);
        using var ortamBastirma = new TransactionScope(
            TransactionScopeOption.Suppress,
            TransactionScopeAsyncFlowOption.Enabled);

        try
        {
            await using var baglanti = new NpgsqlConnection(_baglantiDizesi);
            await baglanti.OpenAsync(cancellationToken);
            await using var transaction = await baglanti.BeginTransactionAsync(
                System.Data.IsolationLevel.ReadCommitted,
                cancellationToken);
            try
            {
                await KaydiEkleAsync(baglanti, transaction, karar, cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return DenetimYazmaSonucu.Kalici;
            }
            catch (PostgresException hata) when (hata.SqlState == PostgresErrorCodes.UniqueViolation)
            {
                await GuvenliRollbackAsync(transaction, cancellationToken);
                return await UzlastirAsync(karar, cancellationToken);
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                await GuvenliRollbackAsync(transaction, cancellationToken);
                return await UzlastirAsync(karar, cancellationToken);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch
        {
            return DenetimYazmaSonucu.BelirsizGuvenliHata;
        }
    }

    private static async Task KaydiEkleAsync(
        NpgsqlConnection baglanti,
        NpgsqlTransaction transaction,
        DenetimKarari karar,
        CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO master.denetim_kaydi
                (id, karar_id, tenant_id, correlation_id, islem, sonuc, gerekce_kodu)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            """;
        await using var komut = new NpgsqlCommand(sql, baglanti, transaction);
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
        await komut.ExecuteNonQueryAsync(cancellationToken);
    }

    private async Task<DenetimYazmaSonucu> UzlastirAsync(
        DenetimKarari karar,
        CancellationToken cancellationToken)
    {
        try
        {
            await using var baglanti = new NpgsqlConnection(_baglantiDizesi);
            await baglanti.OpenAsync(cancellationToken);
            const string sql = """
                SELECT servis_kimligi, tenant_id, correlation_id, islem, sonuc, gerekce_kodu
                FROM master.denetim_kaydi
                WHERE karar_id = $1
                """;
            await using var komut = new NpgsqlCommand(sql, baglanti);
            komut.Parameters.AddWithValue(karar.KararKimligi.Deger);
            await using var okuyucu = await komut.ExecuteReaderAsync(cancellationToken);
            if (!await okuyucu.ReadAsync(cancellationToken))
            {
                return DenetimYazmaSonucu.BelirsizGuvenliHata;
            }

            var ayni =
                okuyucu.GetString(0) == "audit_runtime" &&
                okuyucu.GetGuid(1) == karar.TenantBaglami.TenantId &&
                okuyucu.GetGuid(2) == karar.CorrelationKimligi.Deger &&
                okuyucu.GetString(3) == karar.Islem &&
                okuyucu.GetString(4) == karar.Sonuc &&
                (okuyucu.IsDBNull(5) ? null : okuyucu.GetString(5)) == karar.GerekceKodu;
            return ayni ? DenetimYazmaSonucu.Tekrar : DenetimYazmaSonucu.Catisma;
        }
        catch
        {
            return DenetimYazmaSonucu.BelirsizGuvenliHata;
        }
    }

    private static async Task GuvenliRollbackAsync(
        NpgsqlTransaction transaction,
        CancellationToken cancellationToken)
    {
        try
        {
            await transaction.RollbackAsync(cancellationToken);
        }
        catch
        {
            // Reconciliation gercek sonucu belirler; rollback hatasi basariya cevrilmez.
        }
    }
}
