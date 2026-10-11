namespace TupBayiProje.Moduller.Tenancy.Domain;

// SOT-TEN-001: tenant kimligi. Kimlik veritabani degil uygulama tarafindan UUIDv7 olarak uretilir.
public sealed class Tenant
{
    private Tenant(Guid id) => Id = id;

    public Guid Id { get; private set; }

    public static Tenant Olustur() => new(Guid.CreateVersion7());
}
