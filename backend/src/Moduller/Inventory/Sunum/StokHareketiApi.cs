using TupBayiProje.Gozlemlenebilirlik;
using TupBayiProje.Moduller.Inventory.Domain;
using TupBayiProje.Moduller.Inventory.Sozlesmeler;
using TupBayiProje.Moduller.Inventory.Uygulama;

namespace TupBayiProje.Moduller.Inventory.Sunum;

public sealed class StokHareketiApi(StokHareketiKaydedici kaydedici)
{
    public async ValueTask<StokHareketiKaydetYaniti> KaydetAsync(
        StokHareketiKaydetIstegi istek,
        StokIslemBaglami baglam,
        IzBaglami izBaglami,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(istek);

        var sonuc = await kaydedici.KaydetAsync(
            new StokHareketiKaydetKomutu(
                istek.HareketKimligi,
                istek.IdempotencyAnahtari,
                istek.UrunKimligi,
                TupDurumunuCoz(istek.TupDurumu),
                LokasyonTurunuCoz(istek.KaynakTuru),
                istek.KaynakKimligi,
                LokasyonTurunuCoz(istek.HedefTuru),
                istek.HedefKimligi,
                istek.Miktar),
            baglam,
            izBaglami,
            cancellationToken);

        return new StokHareketiKaydetYaniti(
            sonuc.Basarili,
            sonuc.Tekrar,
            sonuc.HareketKimligi,
            sonuc.HataKodu);
    }

    private static TupDurumu TupDurumunuCoz(string deger) => deger switch
    {
        "FULL" => TupDurumu.Dolu,
        "EMPTY" => TupDurumu.Bos,
        _ => (TupDurumu)(-1),
    };

    private static StokLokasyonTuru LokasyonTurunuCoz(string deger) => deger switch
    {
        "WAREHOUSE" => StokLokasyonTuru.Depo,
        "VEHICLE" => StokLokasyonTuru.Arac,
        "CUSTOMER" => StokLokasyonTuru.Musteri,
        _ => (StokLokasyonTuru)(-1),
    };
}
