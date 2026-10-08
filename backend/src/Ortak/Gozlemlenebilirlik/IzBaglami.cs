using System.Diagnostics;

namespace TupBayiProje.Gozlemlenebilirlik;

public sealed record IzBaglami
{
    private IzBaglami(
        string traceKimligi,
        string spanKimligi,
        string? ustSpanKimligi,
        string korelasyonKimligi,
        string? nedenKimligi)
    {
        TraceKimligi = traceKimligi;
        SpanKimligi = spanKimligi;
        UstSpanKimligi = ustSpanKimligi;
        KorelasyonKimligi = korelasyonKimligi;
        NedenKimligi = nedenKimligi;
    }

    public string TraceKimligi { get; }

    public string SpanKimligi { get; }

    public string? UstSpanKimligi { get; }

    public string KorelasyonKimligi { get; }

    public string? NedenKimligi { get; }

    public static IzBaglami Olustur(string traceKimligi, string korelasyonKimligi) =>
        DisSinirOlustur(
            traceKimligi,
            ActivitySpanId.CreateRandom().ToString(),
            korelasyonKimligi);

    public static IzBaglami DisSinirOlustur(
        string traceKimligi,
        string spanKimligi,
        string korelasyonKimligi,
        string? nedenKimligi = null) =>
        new(
            ZorunluKimlik(traceKimligi, nameof(traceKimligi)),
            ZorunluKimlik(spanKimligi, nameof(spanKimligi)),
            null,
            ZorunluKimlik(korelasyonKimligi, nameof(korelasyonKimligi)),
            IstegeBagliKimlik(nedenKimligi, nameof(nedenKimligi)));

    public IzBaglami AltSpanOlustur(string spanKimligi, string? nedenKimligi = null) =>
        new(
            TraceKimligi,
            ZorunluKimlik(spanKimligi, nameof(spanKimligi)),
            SpanKimligi,
            KorelasyonKimligi,
            IstegeBagliKimlik(nedenKimligi, nameof(nedenKimligi)));

    private static string ZorunluKimlik(string deger, string parametreAdi)
    {
        if (string.IsNullOrWhiteSpace(deger) || deger.Length > 128)
        {
            throw new ArgumentException(
                "Iz kimligi bos veya 128 karakterden uzun olamaz.",
                parametreAdi);
        }

        return deger;
    }

    private static string? IstegeBagliKimlik(string? deger, string parametreAdi) =>
        deger is null ? null : ZorunluKimlik(deger, parametreAdi);
}
