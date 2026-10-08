namespace TupBayiProje.MimariTests.MasterFixture;

// Test-only fixture entity'leri; yalnizca ad ve EF tip bicimini tasir, gercek kolon tasarimi TBP-59'dadir.
public sealed class Kullanici
{
    public Guid Id { get; set; }

    public KullaniciProfili? Profil { get; set; }

    public ICollection<Tenant> Tenantlar { get; } = [];
}

public sealed class KullaniciProfili
{
    public string? GorunenAd { get; set; }
}

public sealed class KullaniciOturumu { public Guid Id { get; set; } }

public sealed class Tenant
{
    public Guid Id { get; set; }

    public ICollection<Kullanici> Kullanicilar { get; } = [];
}

public sealed class TenantVeritabani { public Guid Id { get; set; } }

public sealed class TenantMigrationSurumu { public Guid Id { get; set; } }

public sealed class TenantProvisioningIsi { public Guid Id { get; set; } }

public sealed class TenantMigrationIsi { public Guid Id { get; set; } }

public sealed class Abonelik { public Guid Id { get; set; } }

public sealed class Lisans { public Guid Id { get; set; } }

public sealed class Cihaz { public Guid Id { get; set; } }

public sealed class OdemeNiyeti { public Guid Id { get; set; } }

public sealed class OdemeDenemesi { public Guid Id { get; set; } }

public sealed class OdemeSaglayiciOlayi { public Guid Id { get; set; } }

public sealed class DenetimKaydi { public Guid Id { get; set; } }

// Negatif ornekler.
public sealed class Bilinmeyen { public Guid Id { get; set; } }

public sealed class Musteri { public Guid Id { get; set; } }

public sealed class Tedarikci { public Guid Id { get; set; } }

public sealed class TenantYedekIsi { public Guid Id { get; set; } }
