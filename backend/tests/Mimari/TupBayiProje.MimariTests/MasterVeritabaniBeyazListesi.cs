using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace TupBayiProje.MimariTests;

public sealed record MasterVarlikKaydi(string VarlikAdi, string TabloAdi, string SahipDomain, string SotKimligi);

// Kaynak: docs/mimari/Master-DB-Sema-Sozlesmesi.md §1 (TBP-58, yorum 10867).
// Liste degisikligi ilgili SOT kaydi ve Jira karari olmadan yapilamaz.
public static class MasterVeritabaniBeyazListesi
{
    public static IReadOnlyList<MasterVarlikKaydi> Kayitlar { get; } =
    [
        new("Kullanici", "kullanici", "Identity", "SOT-IDN-001"),
        new("KullaniciOturumu", "kullanici_oturumu", "Identity", "SOT-IDN-001"),
        new("Tenant", "tenant", "Tenancy", "SOT-TEN-001"),
        new("TenantVeritabani", "tenant_veritabani", "Tenancy", "SOT-TEN-001"),
        new("TenantMigrationSurumu", "tenant_migration_surumu", "Tenancy", "SOT-TEN-001"),
        new("TenantProvisioningIsi", "tenant_provisioning_isi", "Tenancy", "SOT-PRV-001"),
        new("TenantMigrationIsi", "tenant_migration_isi", "Tenancy", "SOT-PRV-001"),
        new("Abonelik", "abonelik", "Licensing", "SOT-LIC-001"),
        new("Lisans", "lisans", "Licensing", "SOT-LIC-001"),
        new("Cihaz", "cihaz", "Licensing", "SOT-DEV-001"),
        new("OdemeNiyeti", "odeme_niyeti", "Billing", "SOT-BIL-001"),
        new("OdemeDenemesi", "odeme_denemesi", "Billing", "SOT-BIL-001"),
        new("OdemeSaglayiciOlayi", "odeme_saglayici_olayi", "Billing", "SOT-BIL-001"),
        new("DenetimKaydi", "denetim_kaydi", "Audit", "SOT-AUD-001"),
    ];

    private const string MasterSemasi = "master";

    // Fail-closed: modeldeki her entity tipi (owned ve join dahil) cagiranin acikca verdigi beklenen
    // CLR tiplerinden biriyle birebir ayni olmali ve yalniz master semasindaki whitelist tablosuna
    // eslenmis olmalidir. Entity splitting ile eklenen ikinci tablo da ihlaldir.
    // Tip kimligi referans esitligiyle dogrulanir; ayni ad/namespace'li baska assembly tipi gecemez.
    // Whitelist ust sinirdir; eksik entity ihlal degildir.
    public static IReadOnlyList<string> ModeliDogrula(IModel model, IReadOnlyCollection<Type> beklenenTipler)
    {
        ArgumentNullException.ThrowIfNull(model);
        ArgumentNullException.ThrowIfNull(beklenenTipler);

        var kayitlar = Kayitlar.ToDictionary(kayit => kayit.VarlikAdi, StringComparer.Ordinal);
        var tipKayitlari = BeklenenTipKayitlari(beklenenTipler, kayitlar);
        var ihlaller = new List<string>();

        foreach (var varlik in model.GetEntityTypes())
        {
            var tablo = varlik.GetTableName() ?? "(tablo yok)";

            if (varlik.IsOwned())
            {
                ihlaller.Add($"{varlik.Name}: owned tip whitelist'te bagimsiz entity olarak kayitli degil (tablo {tablo}).");
            }
            else if (varlik.HasSharedClrType)
            {
                ihlaller.Add($"{varlik.Name}: join/shared-type entity whitelist'te kayitli degil (tablo {tablo}).");
            }
            else if (!tipKayitlari.TryGetValue(varlik.ClrType, out var kayit))
            {
                ihlaller.Add(kayitlar.ContainsKey(varlik.ClrType.Name)
                    ? $"{varlik.Name}: whitelist adini tasiyor ama beklenen Master entity tipi degil ({varlik.ClrType.AssemblyQualifiedName})."
                    : $"{varlik.Name}: Master whitelist disi entity (tablo {tablo}).");
            }
            else
            {
                // GetTableName yalniz birincil tabloyu verir; SplitToTable eslemeleri burada gorunur.
                var beklenenTablo = $"{MasterSemasi}.{kayit.TabloAdi}";
                var tablolar = varlik.GetTableMappings()
                    .Select(esleme => $"{esleme.Table.Schema ?? "(sema yok)"}.{esleme.Table.Name}")
                    .ToArray();

                if (tablolar is not [var tekTablo] || !string.Equals(tekTablo, beklenenTablo, StringComparison.Ordinal))
                {
                    ihlaller.Add($"{varlik.Name}: tablo eslemeleri [{string.Join(", ", tablolar)}], whitelist yalniz {beklenenTablo} bekliyor.");
                }
            }
        }

        return ihlaller;
    }

    // Beklenen her tip bir whitelist kaydina kisa adla baglanir; whitelist disi veya ayni kayda
    // ikinci tip verilmesi cagiran hatasidir ve whitelist'i genisletemez.
    private static Dictionary<Type, MasterVarlikKaydi> BeklenenTipKayitlari(
        IReadOnlyCollection<Type> beklenenTipler, Dictionary<string, MasterVarlikKaydi> kayitlar)
    {
        var tipKayitlari = new Dictionary<Type, MasterVarlikKaydi>();
        var kullanilanAdlar = new HashSet<string>(StringComparer.Ordinal);

        foreach (var tip in beklenenTipler)
        {
            ArgumentNullException.ThrowIfNull(tip, nameof(beklenenTipler));

            if (!kayitlar.TryGetValue(tip.Name, out var kayit))
            {
                throw new ArgumentException($"{tip.FullName}: beklenen tip whitelist'te kayitli degil.", nameof(beklenenTipler));
            }

            if (!kullanilanAdlar.Add(tip.Name))
            {
                throw new ArgumentException($"{tip.Name}: whitelist kaydi icin birden fazla beklenen tip verildi.", nameof(beklenenTipler));
            }

            tipKayitlari.Add(tip, kayit);
        }

        return tipKayitlari;
    }
}
