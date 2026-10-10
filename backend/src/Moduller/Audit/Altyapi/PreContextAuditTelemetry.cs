using System.Collections.Frozen;

namespace TupBayiProje.Moduller.Audit.Altyapi;

// Guvenilir tenant baglami kurulmadan once yalniz sabit kodlar yayar.
internal static class PreContextAuditTelemetry
{
    public static IReadOnlyDictionary<string, string> BaglamDogrulanamadi(TimeSpan sure) =>
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["olay_kodu"] = "AUDIT_BAGLAM_DOGRULANAMADI",
            ["sonuc_sinifi"] = "GUVENLI_RET",
            ["sure_araligi"] = SureAraligi(sure),
        }.ToFrozenDictionary(StringComparer.Ordinal);

    private static string SureAraligi(TimeSpan sure) => sure.TotalMilliseconds switch
    {
        <= 10 => "0_10_MS",
        <= 100 => "11_100_MS",
        <= 1000 => "101_1000_MS",
        _ => "1000_MS_USTU",
    };
}
