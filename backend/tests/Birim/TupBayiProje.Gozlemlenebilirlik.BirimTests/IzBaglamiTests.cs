using Xunit;

namespace TupBayiProje.Gozlemlenebilirlik.BirimTests;

public sealed class IzBaglamiTests
{
    [Fact]
    public void TestTbp239Trace04DisSinirButunIzKimlikleriniTasir()
    {
        var baglam = IzBaglami.DisSinirOlustur(
            "trace-1",
            "span-root",
            "corr-1",
            "cause-1");

        Assert.Equal("trace-1", baglam.TraceKimligi);
        Assert.Equal("span-root", baglam.SpanKimligi);
        Assert.Null(baglam.UstSpanKimligi);
        Assert.Equal("corr-1", baglam.KorelasyonKimligi);
        Assert.Equal("cause-1", baglam.NedenKimligi);
    }

    [Fact]
    public void TestTbp239Trace05AltSpanTraceVeKorelasyonuKorur()
    {
        var kok = IzBaglami.DisSinirOlustur("trace-1", "span-root", "corr-1");

        var alt = kok.AltSpanOlustur("span-child", "cause-child");

        Assert.Equal(kok.TraceKimligi, alt.TraceKimligi);
        Assert.Equal(kok.KorelasyonKimligi, alt.KorelasyonKimligi);
        Assert.Equal("span-child", alt.SpanKimligi);
        Assert.Equal("span-root", alt.UstSpanKimligi);
        Assert.Equal("cause-child", alt.NedenKimligi);
    }

    [Fact]
    public void TestTbp239Trace06MevcutOlusturucuGuvenliBirKokSpanUretir()
    {
        var baglam = IzBaglami.Olustur("trace-1", "corr-1");

        Assert.False(string.IsNullOrWhiteSpace(baglam.SpanKimligi));
        Assert.Null(baglam.UstSpanKimligi);
        Assert.Null(baglam.NedenKimligi);
    }

    [Theory]
    [InlineData("", "span-1", "corr-1")]
    [InlineData("trace-1", "", "corr-1")]
    [InlineData("trace-1", "span-1", "")]
    public void TestTbp239Trace07BosZorunluKimligiReddeder(
        string traceKimligi,
        string spanKimligi,
        string korelasyonKimligi)
    {
        Assert.Throws<ArgumentException>(() =>
            IzBaglami.DisSinirOlustur(traceKimligi, spanKimligi, korelasyonKimligi));
    }

    [Fact]
    public void TestTbp239Trace08BosNedenKimliginiVeSiniriAsanKimligiReddeder()
    {
        Assert.Throws<ArgumentException>(() =>
            IzBaglami.DisSinirOlustur("trace-1", "span-1", "corr-1", ""));
        Assert.Throws<ArgumentException>(() =>
            IzBaglami.DisSinirOlustur(new string('t', 129), "span-1", "corr-1"));
    }
}
