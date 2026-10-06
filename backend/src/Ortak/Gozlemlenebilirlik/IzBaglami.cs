namespace TupBayiProje.Gozlemlenebilirlik;

public sealed record IzBaglami
{
    private IzBaglami(string traceKimligi, string korelasyonKimligi)
    {
        TraceKimligi = traceKimligi;
        KorelasyonKimligi = korelasyonKimligi;
    }

    public string TraceKimligi { get; }

    public string KorelasyonKimligi { get; }

    public static IzBaglami Olustur(string traceKimligi, string korelasyonKimligi) =>
        new(
            ZorunluKimlik(traceKimligi, nameof(traceKimligi)),
            ZorunluKimlik(korelasyonKimligi, nameof(korelasyonKimligi)));

    private static string ZorunluKimlik(string deger, string parametreAdi)
    {
        if (string.IsNullOrWhiteSpace(deger))
        {
            throw new ArgumentException("Iz kimligi bos olamaz.", parametreAdi);
        }

        return deger;
    }
}
