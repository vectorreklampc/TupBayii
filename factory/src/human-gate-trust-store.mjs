import { lstatSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname } from "node:path";

const TRUST_STORE_YOLU = process.platform === "win32"
  ? "C:\\ProgramData\\TupBayiProje\\human-gate-keys.json"
  : "/etc/tupbayiproje/human-gate-keys.json";
const GUVENILIR_WINDOWS_SIDLERI = new Set([
  "S-1-5-18",
  "S-1-5-32-544",
  "S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464",
]);
const WINDOWS_YAZMA_HAKLARI = 2 | 4 | 16 | 64 | 256 | 65_536 | 262_144 | 524_288;

export function onayTrustStoreOku() {
  const dizinYolu = dirname(TRUST_STORE_YOLU);
  const dizin = lstatSync(dizinYolu);
  const dosya = lstatSync(TRUST_STORE_YOLU);
  if (!dizin.isDirectory() || !dosya.isFile() || dosya.isSymbolicLink()) {
    throw new Error("Human Gate trust store ve ust dizini normal dosya sistemi nesnesi olmalidir.");
  }
  if (process.platform === "win32") {
    windowsYoluDogrula(dizinYolu);
    windowsYoluDogrula(TRUST_STORE_YOLU);
  } else {
    posixNesnesiniDogrula(dizin);
    posixNesnesiniDogrula(dosya);
  }
  return JSON.parse(readFileSync(TRUST_STORE_YOLU, "utf8"));
}

export function windowsAclGuvenliMi(acl) {
  if (!acl || typeof acl !== "object" || acl.korumaliMi !== true
      || !GUVENILIR_WINDOWS_SIDLERI.has(acl.sahipSid)
      || !Array.isArray(acl.kurallar)) {
    return false;
  }
  return acl.kurallar.every((kural) => {
    if (!kural || typeof kural !== "object"
        || typeof kural.sid !== "string"
        || !Number.isSafeInteger(kural.haklar)
        || !new Set(["Allow", "Deny"]).has(kural.tur)) {
      return false;
    }
    return kural.tur !== "Allow"
      || (kural.haklar & WINDOWS_YAZMA_HAKLARI) === 0
      || GUVENILIR_WINDOWS_SIDLERI.has(kural.sid);
  });
}

function windowsYoluDogrula(yol) {
  const betik = String.raw`
    $ErrorActionPreference = 'Stop'
    $acl = Get-Acl -LiteralPath $args[0]
    $owner = ([System.Security.Principal.NTAccount]$acl.Owner).Translate([System.Security.Principal.SecurityIdentifier]).Value
    $rules = @($acl.Access | ForEach-Object {
      [pscustomobject]@{
        sid = $_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value
        tur = $_.AccessControlType.ToString()
        haklar = [int]$_.FileSystemRights
      }
    })
    [pscustomobject]@{
      sahipSid = $owner
      korumaliMi = [bool]$acl.AreAccessRulesProtected
      kurallar = $rules
    } | ConvertTo-Json -Compress -Depth 4
  `;
  const sonuc = spawnSync(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", betik, yol],
    { encoding: "utf8", windowsHide: true, maxBuffer: 128 * 1024 },
  );
  if (sonuc.status !== 0) {
    throw new Error("Human Gate trust store Windows ACL bilgisi dogrulanamadi.");
  }
  let acl;
  try {
    acl = JSON.parse(sonuc.stdout);
  } catch {
    throw new Error("Human Gate trust store Windows ACL ciktisi gecersiz.");
  }
  if (!windowsAclGuvenliMi(acl)) {
    throw new Error("Human Gate trust store yalniz SYSTEM/Administrators yazmasina acik olmalidir.");
  }
}

function posixNesnesiniDogrula(nesne) {
  if (nesne.uid !== 0 || (nesne.mode & 0o022) !== 0) {
    throw new Error("Human Gate trust store root sahipli ve grup/dunya yazmasina kapali olmalidir.");
  }
}
