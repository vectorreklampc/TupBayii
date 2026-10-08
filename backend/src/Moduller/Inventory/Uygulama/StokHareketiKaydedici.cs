using TupBayiProje.Gozlemlenebilirlik;
using TupBayiProje.Moduller.Inventory.Domain;

namespace TupBayiProje.Moduller.Inventory.Uygulama;

public sealed class StokHareketiKaydedici(
    IStokHareketiDeposu depo,
    IAuditKaydiYazici auditKaydiYazici,
    TimeProvider zamanSaglayici)
{
    public async ValueTask<StokHareketiKaydetSonucu> KaydetAsync(
        StokHareketiKaydetKomutu komut,
        StokIslemBaglami baglam,
        IzBaglami izBaglami,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(komut);
        ArgumentNullException.ThrowIfNull(baglam);
        ArgumentNullException.ThrowIfNull(izBaglami);

        if (string.IsNullOrWhiteSpace(komut.IdempotencyAnahtari))
        {
            return await RetAsync(
                komut.HareketKimligi,
                baglam,
                izBaglami,
                "STOK_HAREKETI_IDEMPOTENCY_ANAHTARI_GECERSIZ",
                cancellationToken);
        }

        StokHareketi hareket;
        try
        {
            hareket = StokHareketi.Olustur(
                komut.HareketKimligi,
                komut.UrunKimligi,
                komut.Durum,
                StokLokasyonu.Olustur(komut.KaynakTuru, komut.KaynakKimligi),
                StokLokasyonu.Olustur(komut.HedefTuru, komut.HedefKimligi),
                komut.Miktar,
                zamanSaglayici.GetUtcNow());
        }
        catch (StokHareketiKuraliHatasi hata)
        {
            return await RetAsync(
                komut.HareketKimligi,
                baglam,
                izBaglami,
                hata.Kod,
                cancellationToken);
        }

        var depoSonucu = await depo.AtomikKaydetAsync(
            baglam,
            komut.IdempotencyAnahtari,
            hareket,
            cancellationToken);
        var sonuc = depoSonucu switch
        {
            StokHareketiDepoSonucu.Kaydedildi =>
                new StokHareketiKaydetSonucu(true, false, hareket.HareketKimligi, null),
            StokHareketiDepoSonucu.Tekrar =>
                new StokHareketiKaydetSonucu(true, true, hareket.HareketKimligi, null),
            StokHareketiDepoSonucu.IdempotencyConflict =>
                new StokHareketiKaydetSonucu(
                    false,
                    false,
                    hareket.HareketKimligi,
                    "STOK_HAREKETI_IDEMPOTENCY_CONFLICT"),
            StokHareketiDepoSonucu.HareketKimligiConflict =>
                new StokHareketiKaydetSonucu(
                    false,
                    false,
                    hareket.HareketKimligi,
                    "STOK_HAREKETI_KIMLIGI_CONFLICT"),
            StokHareketiDepoSonucu.KaynakStokYetersiz =>
                new StokHareketiKaydetSonucu(
                    false,
                    false,
                    hareket.HareketKimligi,
                    "STOK_HAREKETI_KAYNAK_STOK_YETERSIZ"),
            _ => throw new InvalidOperationException("Bilinmeyen stok hareketi depo sonucu."),
        };

        await AuditEtAsync(
            baglam,
            izBaglami,
            sonuc.HataKodu ?? (sonuc.Tekrar
                ? "STOK_HAREKETI_TEKRAR"
                : "STOK_HAREKETI_KAYDEDILDI"),
            cancellationToken);
        return sonuc;
    }

    private async ValueTask<StokHareketiKaydetSonucu> RetAsync(
        string hareketKimligi,
        StokIslemBaglami baglam,
        IzBaglami izBaglami,
        string hataKodu,
        CancellationToken cancellationToken)
    {
        await AuditEtAsync(baglam, izBaglami, hataKodu, cancellationToken);
        return new StokHareketiKaydetSonucu(false, false, hareketKimligi, hataKodu);
    }

    private ValueTask AuditEtAsync(
        StokIslemBaglami baglam,
        IzBaglami izBaglami,
        string sonucKodu,
        CancellationToken cancellationToken) =>
        auditKaydiYazici.EkleAsync(
            new AuditKaydi(
                "stok_hareketi_kaydetme",
                baglam.EyleyenKimligi,
                baglam.TenantKimligi,
                zamanSaglayici.GetUtcNow(),
                izBaglami.TraceKimligi,
                izBaglami.SpanKimligi,
                izBaglami.KorelasyonKimligi,
                izBaglami.NedenKimligi,
                sonucKodu),
            cancellationToken);
}
