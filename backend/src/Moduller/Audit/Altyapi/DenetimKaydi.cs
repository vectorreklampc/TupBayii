namespace TupBayiProje.Moduller.Audit.Altyapi;

public sealed class DenetimKaydi
{
    private DenetimKaydi()
    {
    }

    internal DenetimKaydi(
        Guid id,
        KararKimligi kararKimligi,
        Guid tenantId,
        CorrelationKimligi correlationKimligi,
        string islem,
        string sonuc,
        string? gerekceKodu)
    {
        Id = id;
        KararKimligi = kararKimligi;
        TenantId = tenantId;
        CorrelationKimligi = correlationKimligi;
        Islem = islem;
        Sonuc = sonuc;
        GerekceKodu = gerekceKodu;
    }

    public Guid Id { get; private set; }

    public KararKimligi KararKimligi { get; private set; } = null!;

    public string ServisKimligi { get; private set; } = null!;

    public Guid TenantId { get; private set; }

    public CorrelationKimligi CorrelationKimligi { get; private set; } = null!;

    public string Islem { get; private set; } = null!;

    public string Sonuc { get; private set; } = null!;

    public string? GerekceKodu { get; private set; }

    // INSERT statement baslangic zamanidir; business veya durable commit zamani degildir.
    public DateTimeOffset OlusturulmaZamani { get; private set; }
}
