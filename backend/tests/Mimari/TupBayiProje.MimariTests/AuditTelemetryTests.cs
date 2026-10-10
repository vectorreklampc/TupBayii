using TupBayiProje.Moduller.Audit.Altyapi;
using Xunit;

namespace TupBayiProje.MimariTests;

public sealed class AuditTelemetryTests
{
    [Theory]
    [InlineData(0, "0_10_MS")]
    [InlineData(40, "11_100_MS")]
    [InlineData(500, "101_1000_MS")]
    [InlineData(5000, "1000_MS_USTU")]
    public void PreContextOlayi_YalnizUcSabitPropertyVeBucketDegeriUretir(
        int sureMilisaniye,
        string beklenenAralik)
    {
        var olay = PreContextAuditTelemetry.BaglamDogrulanamadi(
            TimeSpan.FromMilliseconds(sureMilisaniye));

        Assert.Equal(
            ["olay_kodu", "sonuc_sinifi", "sure_araligi"],
            olay.Keys.Order(StringComparer.Ordinal));
        Assert.Equal("AUDIT_BAGLAM_DOGRULANAMADI", olay["olay_kodu"]);
        Assert.Equal("GUVENLI_RET", olay["sonuc_sinifi"]);
        Assert.Equal(beklenenAralik, olay["sure_araligi"]);
    }

    [Fact]
    public void PreContextOlayi_ExceptionVeyaPayloadKabulEdenPublicYuzeySunmaz()
    {
        var publicMetotlar = typeof(PreContextAuditTelemetry).GetMethods(
            System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);

        Assert.All(publicMetotlar, metot => Assert.All(
            metot.GetParameters(),
            parametre => Assert.Equal(typeof(TimeSpan), parametre.ParameterType)));
    }
}
