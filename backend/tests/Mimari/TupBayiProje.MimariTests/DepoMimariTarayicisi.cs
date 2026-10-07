using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace TupBayiProje.MimariTests;

internal sealed record DepoMimariRaporu(
    int IncelenenProjeSayisi,
    int CalistirilanKuralAilesiSayisi,
    IReadOnlyList<string> Ihlaller);

internal static partial class DepoMimariTarayicisi
{
    private const int KuralAilesiSayisi = 4;

    public static DepoMimariRaporu Tara(string backendKoku)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(backendKoku);

        var kaynakKoku = Path.Combine(backendKoku, "src");
        var projeDosyalari = Directory
            .EnumerateFiles(kaynakKoku, "*.csproj", SearchOption.AllDirectories)
            .Order(StringComparer.Ordinal)
            .ToArray();
        var ihlaller = new List<string>();
        var projeler = ProjeleriOku(backendKoku, projeDosyalari, ihlaller);

        ihlaller.AddRange(MimariKuralMotoru.ProjeBagimliliklariniDogrula(projeler));
        ihlaller.AddRange(KaynakKodBagimliliklariniDogrula(backendKoku));
        ihlaller.AddRange(MimariKuralMotoru.VeritabaniSinirlariniDogrula(
            projeDosyalari.Select(dosya => VeritabaniProjesiniOku(dosya, ihlaller))));

        return new DepoMimariRaporu(
            projeDosyalari.Length,
            KuralAilesiSayisi,
            ihlaller.Order(StringComparer.Ordinal).ToArray());
    }

    private static List<ProjeTanim> ProjeleriOku(
        string backendKoku,
        IReadOnlyCollection<string> projeDosyalari,
        List<string> ihlaller)
    {
        var dosyayaGoreProjeAdi = projeDosyalari.ToDictionary(
            Path.GetFullPath,
            yol => Path.GetFileNameWithoutExtension(yol)!,
            StringComparer.OrdinalIgnoreCase);
        var projeler = new List<ProjeTanim>();

        foreach (var projeDosyasi in projeDosyalari)
        {
            var projeAdi = Path.GetFileNameWithoutExtension(projeDosyasi);
            if (!KonumuCoz(backendKoku, projeDosyasi, out var modul, out var katman))
            {
                ihlaller.Add($"{projeAdi}, desteklenen backend mimari dizinlerinden birinde degil.");
                continue;
            }

            var belge = XDocument.Load(projeDosyasi, LoadOptions.None);
            var projeDizini = Path.GetDirectoryName(projeDosyasi)
                ?? throw new InvalidOperationException($"Proje dizini bulunamadi: {projeDosyasi}");
            var referanslar = belge
                .Descendants()
                .Where(oge => oge.Name.LocalName == "ProjectReference")
                .Select(oge => oge.Attribute("Include")?.Value)
                .Where(deger => !string.IsNullOrWhiteSpace(deger))
                .Select(deger => Path.GetFullPath(Path.Combine(projeDizini, deger!)))
                .Select(yol => dosyayaGoreProjeAdi.TryGetValue(yol, out var ad)
                    ? ad
                    : Path.GetFileNameWithoutExtension(yol)
                        ?? throw new InvalidOperationException($"Referans proje adi bulunamadi: {yol}"))
                .ToArray();

            projeler.Add(new ProjeTanim(projeAdi, modul, katman, referanslar));
        }

        return projeler;
    }

    private static VeritabaniProjesiTanim VeritabaniProjesiniOku(
        string projeDosyasi,
        List<string> ihlaller)
    {
        var belge = XDocument.Load(projeDosyasi, LoadOptions.None);
        var projeAdi = Path.GetFileNameWithoutExtension(projeDosyasi);
        var sinirMetni = OzellikDegeriniOku(belge, "TupBayiVeritabaniSiniri");
        var tenantBasinaMetni = OzellikDegeriniOku(belge, "TupBayiTenantBasinaFizikselVeritabani");
        var sinir = VeritabaniSiniriniCoz(projeAdi, sinirMetni, ihlaller);
        var tenantBasina = bool.TryParse(tenantBasinaMetni, out var sonuc) && sonuc;
        var projeDizini = Path.GetDirectoryName(projeDosyasi)
            ?? throw new InvalidOperationException($"Proje dizini bulunamadi: {projeDosyasi}");
        var baglamAdlari = VeritabaniBaglamlariniBul(projeDizini);
        var kaliciVarlikAdlari = KaliciVeritabaniVarliklariniBul(projeDizini);

        return new VeritabaniProjesiTanim(
            projeAdi,
            sinir,
            tenantBasina,
            baglamAdlari,
            kaliciVarlikAdlari);
    }

    private static HashSet<string> VeritabaniBaglamlariniBul(string projeDizini)
    {
        var baglamAdlari = new HashSet<string>(StringComparer.Ordinal);

        foreach (var dosya in Directory.EnumerateFiles(projeDizini, "*.cs", SearchOption.AllDirectories))
        {
            if (YokSayilanDizindeMi(projeDizini, dosya))
            {
                continue;
            }

            var icerik = File.ReadAllText(dosya);
            foreach (Match eslesme in SinifBildirimiDeseni().Matches(icerik))
            {
                var ad = eslesme.Groups["ad"].Value;
                var kalitim = eslesme.Groups["kalitim"].Value;
                if (ad.EndsWith("VeritabaniBaglami", StringComparison.Ordinal)
                    || kalitim.Contains("DbContext", StringComparison.Ordinal))
                {
                    baglamAdlari.Add(ad);
                }
            }
        }

        return baglamAdlari;
    }

    private static HashSet<string> KaliciVeritabaniVarliklariniBul(string projeDizini)
    {
        var varlikAdlari = new HashSet<string>(StringComparer.Ordinal);

        foreach (var dosya in Directory.EnumerateFiles(projeDizini, "*.cs", SearchOption.AllDirectories))
        {
            if (YokSayilanDizindeMi(projeDizini, dosya))
            {
                continue;
            }

            var icerik = File.ReadAllText(dosya);
            foreach (Match eslesme in KaliciVarlikDeseni().Matches(icerik))
            {
                var tamAd = eslesme.Groups["ad"].Value;
                varlikAdlari.Add(tamAd[(tamAd.LastIndexOf('.') + 1)..]);
            }
        }

        return varlikAdlari;
    }

    private static bool YokSayilanDizindeMi(string projeDizini, string dosya)
    {
        var goreliYol = Path.GetRelativePath(projeDizini, dosya);
        var parcalar = goreliYol.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        return parcalar.Any(parca => parca is "bin" or "obj");
    }

    private static string? OzellikDegeriniOku(XContainer belge, string ad) =>
        belge.Descendants()
            .FirstOrDefault(oge => oge.Name.LocalName == ad)
            ?.Value.Trim();

    private static VeritabaniSiniri VeritabaniSiniriniCoz(
        string projeAdi,
        string? deger,
        List<string> ihlaller)
    {
        if (string.IsNullOrWhiteSpace(deger) || deger.Equals("Yok", StringComparison.OrdinalIgnoreCase))
        {
            return VeritabaniSiniri.Yok;
        }

        if (Enum.TryParse<VeritabaniSiniri>(deger, ignoreCase: true, out var sinir))
        {
            return sinir;
        }

        ihlaller.Add($"{projeAdi}, gecersiz TupBayiVeritabaniSiniri degeri kullaniyor: {deger}.");
        return VeritabaniSiniri.Yok;
    }

    private static bool KonumuCoz(
        string backendKoku,
        string projeDosyasi,
        out string? modul,
        out Katman katman)
    {
        var goreliYol = Path.GetRelativePath(backendKoku, projeDosyasi);
        var parcalar = goreliYol.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        modul = null;
        katman = Katman.Host;

        if (parcalar.Length >= 3
            && parcalar[0].Equals("src", StringComparison.OrdinalIgnoreCase)
            && parcalar[1].Equals("Sunum", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (parcalar.Length >= 3
            && parcalar[0].Equals("src", StringComparison.OrdinalIgnoreCase)
            && parcalar[1].Equals("Ortak", StringComparison.OrdinalIgnoreCase))
        {
            katman = Katman.Ortak;
            return true;
        }

        if (parcalar.Length < 4
            || !parcalar[0].Equals("src", StringComparison.OrdinalIgnoreCase)
            || !parcalar[1].Equals("Moduller", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        modul = parcalar[2];
        if (parcalar.Length == 4)
        {
            katman = Katman.Modul;
            return true;
        }

        return Enum.TryParse(parcalar[3], ignoreCase: true, out katman);
    }

    private static List<string> KaynakKodBagimliliklariniDogrula(string backendKoku)
    {
        var modullerKoku = Path.Combine(backendKoku, "src", "Moduller");
        if (!Directory.Exists(modullerKoku))
        {
            return new List<string>();
        }

        var ihlaller = new List<string>();
        foreach (var dosya in Directory.EnumerateFiles(modullerKoku, "*.cs", SearchOption.AllDirectories))
        {
            if (YokSayilanDizindeMi(modullerKoku, dosya))
            {
                continue;
            }

            var goreliYol = Path.GetRelativePath(modullerKoku, dosya);
            var parcalar = goreliYol.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            if (parcalar.Length < 3
                || !Enum.TryParse<Katman>(parcalar[1], ignoreCase: true, out var kaynakKatman)
                || kaynakKatman is Katman.Modul or Katman.Host or Katman.Ortak)
            {
                continue;
            }

            var kaynakModul = parcalar[0];
            var icerik = File.ReadAllText(dosya);
            if (TipBildirimiDeseni().IsMatch(icerik)
                && !KanonikNamespaceKullaniyor(icerik, kaynakModul, kaynakKatman))
            {
                ihlaller.Add(
                    $"{goreliYol}, TupBayiProje.Moduller.{kaynakModul}.{kaynakKatman} namespace sinirinda olmalidir.");
            }

            foreach (Match eslesme in ModulKatmanReferansiDeseni().Matches(icerik))
            {
                var hedefModul = eslesme.Groups["modul"].Value;
                var hedefKatman = Enum.Parse<Katman>(eslesme.Groups["katman"].Value);
                if (StringComparer.OrdinalIgnoreCase.Equals(kaynakModul, hedefModul)
                    && kaynakKatman == hedefKatman)
                {
                    continue;
                }

                var kaynak = new ProjeTanim("Kaynak", kaynakModul, kaynakKatman, ["Hedef"]);
                var hedef = new ProjeTanim("Hedef", hedefModul, hedefKatman, []);
                if (MimariKuralMotoru.ProjeBagimliliklariniDogrula([kaynak, hedef]).Count > 0)
                {
                    ihlaller.Add(
                        $"{goreliYol}, {hedefModul}.{hedefKatman} referansiyla katman yonunu veya modul sinirini ihlal ediyor.");
                }
            }
        }

        return ihlaller;
    }

    private static bool KanonikNamespaceKullaniyor(
        string icerik,
        string beklenenModul,
        Katman beklenenKatman)
    {
        var eslesme = NamespaceBildirimiDeseni().Match(icerik);
        return eslesme.Success
            && eslesme.Groups["modul"].Value.Equals(beklenenModul, StringComparison.Ordinal)
            && eslesme.Groups["katman"].Value.Equals(beklenenKatman.ToString(), StringComparison.Ordinal);
    }

    [GeneratedRegex(
        @"\bclass\s+(?<ad>[A-Za-z_][A-Za-z0-9_]*)\s*(?<kalitim>:[^{;]+)?[{;]",
        RegexOptions.CultureInvariant)]
    private static partial Regex SinifBildirimiDeseni();

    [GeneratedRegex(
        @"\bTupBayiProje\.Moduller\.(?<modul>[A-Za-z_][A-Za-z0-9_]*)\.(?<katman>Domain|Uygulama|Altyapi|Sunum|Sozlesmeler)\b",
        RegexOptions.CultureInvariant)]
    private static partial Regex ModulKatmanReferansiDeseni();

    [GeneratedRegex(
        @"\bnamespace\s+TupBayiProje\.Moduller\.(?<modul>[A-Za-z_][A-Za-z0-9_]*)\.(?<katman>Domain|Uygulama|Altyapi|Sunum|Sozlesmeler)(?:\.|\s*[;{])",
        RegexOptions.CultureInvariant)]
    private static partial Regex NamespaceBildirimiDeseni();

    [GeneratedRegex(
        @"\b(?:class|interface|record|struct|enum)\s+[A-Za-z_]",
        RegexOptions.CultureInvariant)]
    private static partial Regex TipBildirimiDeseni();

    [GeneratedRegex(
        @"\b(?:DbSet|Entity)\s*<\s*(?<ad>[A-Za-z_][A-Za-z0-9_.]*)\s*>",
        RegexOptions.CultureInvariant)]
    private static partial Regex KaliciVarlikDeseni();
}
