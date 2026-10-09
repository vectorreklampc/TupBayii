export function riskiDegerlendir(girdi) {
  return {
    riskSeviyesi: girdi.baslik,
    nedenKodlari: girdi.etiketler,
    codexOnIncelemeGerekliMi: true,
    insanKapisiGerekliMi: false,
  };
}
