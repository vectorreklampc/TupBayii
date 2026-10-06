namespace TupBayiProje.Gozlemlenebilirlik;

public sealed record AuditKaydi(
    string OlayAdi,
    string? EyleyenKimligi,
    string? TenantKimligi,
    DateTimeOffset OlusturulmaZamani,
    string TraceKimligi,
    string KorelasyonKimligi,
    string SonucKodu);

public interface IAuditKaydiYazici
{
    ValueTask EkleAsync(
        AuditKaydi kayit,
        CancellationToken cancellationToken = default);
}
