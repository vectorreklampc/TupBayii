using TupBayiProje.Gozlemlenebilirlik;

namespace TupBayiProje.Tenancy.BirimTests;

internal sealed class BellekAuditYazici : IAuditKaydiYazici
{
    public List<AuditKaydi> Kayitlar { get; } = [];

    public ValueTask EkleAsync(AuditKaydi kayit, CancellationToken cancellationToken = default)
    {
        Kayitlar.Add(kayit);
        return ValueTask.CompletedTask;
    }
}
