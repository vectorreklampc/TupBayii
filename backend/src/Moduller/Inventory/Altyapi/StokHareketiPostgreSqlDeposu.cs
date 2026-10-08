using System.Data;
using System.Data.Common;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using TupBayiProje.Moduller.Inventory.Domain;
using TupBayiProje.Moduller.Inventory.Uygulama;

namespace TupBayiProje.Moduller.Inventory.Altyapi;

public sealed class StokHareketiPostgreSqlDeposu(
    Func<StokIslemBaglami, CancellationToken, ValueTask<DbConnection>> baglantiAcici)
    : IStokHareketiDeposu
{
    private const string IslemTuru = "STOK_HAREKETI_KAYDET";

    public async ValueTask<StokHareketiDepoSonucu> AtomikKaydetAsync(
        StokIslemBaglami baglam,
        string idempotencyAnahtari,
        StokHareketi hareket,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(baglam);
        ArgumentException.ThrowIfNullOrWhiteSpace(idempotencyAnahtari);
        ArgumentNullException.ThrowIfNull(hareket);

        await using var baglanti = await baglantiAcici(baglam, cancellationToken);
        if (baglanti.State is not ConnectionState.Open)
        {
            await baglanti.OpenAsync(cancellationToken);
        }

        await using var transaction = await baglanti.BeginTransactionAsync(
            IsolationLevel.Serializable,
            cancellationToken);

        try
        {
            var istekHash = IstekHashOlustur(hareket);
            var claimEklendi = await CalistirAsync(
                baglanti,
                transaction,
                """
                INSERT INTO stok_idempotency
                    (operation_type, idempotency_key, request_hash, hareket_kimligi)
                VALUES
                    (@operation_type, @idempotency_key, @request_hash, @hareket_kimligi)
                ON CONFLICT (operation_type, idempotency_key) DO NOTHING;
                """,
                cancellationToken,
                ("operation_type", IslemTuru),
                ("idempotency_key", idempotencyAnahtari),
                ("request_hash", istekHash),
                ("hareket_kimligi", hareket.HareketKimligi));

            if (claimEklendi == 0)
            {
                var mevcutHash = await TekDegerOkuAsync(
                    baglanti,
                    transaction,
                    """
                    SELECT request_hash
                    FROM stok_idempotency
                    WHERE operation_type = @operation_type
                      AND idempotency_key = @idempotency_key;
                    """,
                    cancellationToken,
                    ("operation_type", IslemTuru),
                    ("idempotency_key", idempotencyAnahtari));
                await transaction.RollbackAsync(cancellationToken);
                return StringComparer.Ordinal.Equals(mevcutHash, istekHash)
                    ? StokHareketiDepoSonucu.Tekrar
                    : StokHareketiDepoSonucu.IdempotencyConflict;
            }

            var kaynakGuncellendi = await CalistirAsync(
                baglanti,
                transaction,
                """
                UPDATE stok_projection
                SET miktar = miktar - @miktar
                WHERE urun_kimligi = @urun_kimligi
                  AND tup_durumu = @tup_durumu
                  AND lokasyon_turu = @kaynak_turu
                  AND lokasyon_kimligi = @kaynak_kimligi
                  AND miktar >= @miktar;
                """,
                cancellationToken,
                ("miktar", hareket.Miktar),
                ("urun_kimligi", hareket.UrunKimligi),
                ("tup_durumu", DurumKodu(hareket.Durum)),
                ("kaynak_turu", LokasyonTuruKodu(hareket.Kaynak.Tur)),
                ("kaynak_kimligi", hareket.Kaynak.Kimlik));

            if (kaynakGuncellendi == 0)
            {
                await transaction.RollbackAsync(cancellationToken);
                return StokHareketiDepoSonucu.KaynakStokYetersiz;
            }

            var hareketEklendi = await CalistirAsync(
                baglanti,
                transaction,
                """
                INSERT INTO stok_hareketleri
                    (hareket_kimligi, urun_kimligi, tup_durumu,
                     kaynak_turu, kaynak_kimligi, hedef_turu, hedef_kimligi,
                     miktar, olusturulma_zamani)
                VALUES
                    (@hareket_kimligi, @urun_kimligi, @tup_durumu,
                     @kaynak_turu, @kaynak_kimligi, @hedef_turu, @hedef_kimligi,
                     @miktar, @olusturulma_zamani)
                ON CONFLICT (hareket_kimligi) DO NOTHING;
                """,
                cancellationToken,
                ("hareket_kimligi", hareket.HareketKimligi),
                ("urun_kimligi", hareket.UrunKimligi),
                ("tup_durumu", DurumKodu(hareket.Durum)),
                ("kaynak_turu", LokasyonTuruKodu(hareket.Kaynak.Tur)),
                ("kaynak_kimligi", hareket.Kaynak.Kimlik),
                ("hedef_turu", LokasyonTuruKodu(hareket.Hedef.Tur)),
                ("hedef_kimligi", hareket.Hedef.Kimlik),
                ("miktar", hareket.Miktar),
                ("olusturulma_zamani", hareket.OlusturulmaZamani));

            if (hareketEklendi == 0)
            {
                await transaction.RollbackAsync(cancellationToken);
                return StokHareketiDepoSonucu.HareketKimligiConflict;
            }

            await CalistirAsync(
                baglanti,
                transaction,
                """
                INSERT INTO stok_projection
                    (urun_kimligi, tup_durumu, lokasyon_turu, lokasyon_kimligi, miktar)
                VALUES
                    (@urun_kimligi, @tup_durumu, @hedef_turu, @hedef_kimligi, @miktar)
                ON CONFLICT (urun_kimligi, tup_durumu, lokasyon_turu, lokasyon_kimligi)
                DO UPDATE SET miktar = stok_projection.miktar + EXCLUDED.miktar;
                """,
                cancellationToken,
                ("urun_kimligi", hareket.UrunKimligi),
                ("tup_durumu", DurumKodu(hareket.Durum)),
                ("hedef_turu", LokasyonTuruKodu(hareket.Hedef.Tur)),
                ("hedef_kimligi", hareket.Hedef.Kimlik),
                ("miktar", hareket.Miktar));

            await transaction.CommitAsync(cancellationToken);
            return StokHareketiDepoSonucu.Kaydedildi;
        }
        catch
        {
            await transaction.RollbackAsync(CancellationToken.None);
            throw;
        }
    }

    private static async ValueTask<int> CalistirAsync(
        DbConnection baglanti,
        DbTransaction transaction,
        string sql,
        CancellationToken cancellationToken,
        params (string Ad, object Deger)[] parametreler)
    {
        await using var komut = KomutOlustur(baglanti, transaction, sql, parametreler);
        return await komut.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async ValueTask<string?> TekDegerOkuAsync(
        DbConnection baglanti,
        DbTransaction transaction,
        string sql,
        CancellationToken cancellationToken,
        params (string Ad, object Deger)[] parametreler)
    {
        await using var komut = KomutOlustur(baglanti, transaction, sql, parametreler);
        return await komut.ExecuteScalarAsync(cancellationToken) as string;
    }

    private static DbCommand KomutOlustur(
        DbConnection baglanti,
        DbTransaction transaction,
        string sql,
        IEnumerable<(string Ad, object Deger)> parametreler)
    {
        var komut = baglanti.CreateCommand();
        komut.Transaction = transaction;
        komut.CommandText = sql;
        foreach (var (ad, deger) in parametreler)
        {
            var parametre = komut.CreateParameter();
            parametre.ParameterName = $"@{ad}";
            parametre.Value = deger;
            komut.Parameters.Add(parametre);
        }

        return komut;
    }

    private static string IstekHashOlustur(StokHareketi hareket)
    {
        var kanonikIstek = JsonSerializer.Serialize(new object[]
        {
            hareket.HareketKimligi,
            hareket.UrunKimligi,
            DurumKodu(hareket.Durum),
            LokasyonTuruKodu(hareket.Kaynak.Tur),
            hareket.Kaynak.Kimlik,
            LokasyonTuruKodu(hareket.Hedef.Tur),
            hareket.Hedef.Kimlik,
            hareket.Miktar,
        });
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(kanonikIstek)));
    }

    private static string DurumKodu(TupDurumu durum) => durum switch
    {
        TupDurumu.Dolu => "FULL",
        TupDurumu.Bos => "EMPTY",
        _ => throw new InvalidOperationException("Bilinmeyen tup durumu."),
    };

    private static string LokasyonTuruKodu(StokLokasyonTuru tur) => tur switch
    {
        StokLokasyonTuru.Depo => "WAREHOUSE",
        StokLokasyonTuru.Arac => "VEHICLE",
        StokLokasyonTuru.Musteri => "CUSTOMER",
        _ => throw new InvalidOperationException("Bilinmeyen stok lokasyon turu."),
    };
}
