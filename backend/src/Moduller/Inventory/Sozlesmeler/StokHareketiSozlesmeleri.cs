namespace TupBayiProje.Moduller.Inventory.Sozlesmeler;

public sealed record StokHareketiKaydetIstegi(
    string HareketKimligi,
    string IdempotencyAnahtari,
    string UrunKimligi,
    string TupDurumu,
    string KaynakTuru,
    string KaynakKimligi,
    string HedefTuru,
    string HedefKimligi,
    int Miktar);

public sealed record StokHareketiKaydetYaniti(
    bool Basarili,
    bool Tekrar,
    string HareketKimligi,
    string? HataKodu);
