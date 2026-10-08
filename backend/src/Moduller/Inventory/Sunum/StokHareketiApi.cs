using TupBayiProje.Gozlemlenebilirlik;
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
            StokHareketiKomutCozumleyici.Coz(istek),
            baglam,
            izBaglami,
            cancellationToken);

        return new StokHareketiKaydetYaniti(
            sonuc.Basarili,
            sonuc.Tekrar,
            sonuc.HareketKimligi,
            sonuc.HataKodu);
    }
}
