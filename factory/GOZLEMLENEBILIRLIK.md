# TBP-239 Gozlemlenebilirlik ve Canli Hata Geri Besleme Dongusu

`src/gozlemlenebilirlik.mjs`, factory calismalarinin vendor bagimsiz telemetry
sozlesmesini ve canli hata geri besleme durumlarini kalici SQLite kaydinda
tutar. Amac su operasyon sorularini cevaplamaktir:

- Bir `traceId` hangi component/span'de ve hangi sonuc koduyla bozuldu?
- Hata hangi Jira isi, release, commit ve deployment ile iliskiliydi?
- Belirli bir component/islem icin hata orani ile p50/p95/p99 gecikme nedir?
- LLM triage'a giden diagnostic bundle secret veya PII tasiyor mu?
- Kritik duzeltme bagimsiz test, Codex review, staging smoke ve Human Gate
  olmadan production dogrulamasina ilerleyebiliyor mu?

## Telemetry sozlesmesi

Her telemetry olayi sabit alan listesiyle kaydedilir. `traceKimligi`,
`spanKimligi`, `korelasyonKimligi`, `bilesen`, `girisNoktasi`, `islem`,
`sonucKodu` ve UTC zaman zorunludur. Child span kaydi ayni trace icindeki
parent span kaydindan once yazilamaz. Kayitlar update/delete trigger'lariyla
immutable'dir. Request body, serbest metadata, token, e-posta ve benzeri
allowlist disi alanlar fail-closed reddedilir.
Allowlist alanlarinin degerleri de serbest metin degildir: olay adi ve sonuc
kodu kanonik kod bicimi; component, span ve referanslar sinirli makine kimligi
bicimi tasir. Boylece alan adi dogru gorunen bir deger icine request metni,
e-posta veya secret gomulemez.

`redOzetiGetir`, yalniz dusuk-cardinality `bilesen` ve `islem` boyutlarinda
request count, error ratio ve percentile latency uretir. `traceId`, kullanici,
tenant, ham URL ve hata mesaji metric etiketi degildir. Saklanan sozlesme
OpenTelemetry/Prometheus/Grafana/Zipkin/Graylog adapterlerine kaynak olabilir;
urun-spesifik exporter ve dashboard kurulumu P16 `TBP-203` kapsamina birakilir.

## Canli hata geri besleme

`canliHataPaketiOlustur`, yalniz `ERROR` kaydi bulunan trace'ten maskelenmis ve
deterministik diagnostic bundle uretir. LLM triage ciktisi komut degil veri
olarak dogrulanir; bilinmeyen alan, eksik `TEST-*` reproducer veya eksik
`INV-*` eslemesi reddedilir. Ardindan kalici akis su kanitli sirayi zorlar:

```text
JIRA_BUG_HAZIR -> JIRA_BUG_OLUSTURULDU
-> RISK_INVARIANT_KONTROLU_GECTI -> DUZELTME_UYGULANDI
-> BAGIMSIZ_TEST_GECTI -> CODEX_ONAYLADI -> STAGING_SMOKE_GECTI
-> [INSAN_ONAYI_VERILDI] -> PRODUCTION_DOGRULANDI
```

Koseli adim risk motorunun Human Gate gerektirdigi duzeltmelerde zorunludur.
Modul Jira'ya, LLM'ye veya production'a dogrudan ag cagrisi yapmaz; guvenli
paket ve kanitli handoff uretir. Gercek provider adapteri bu siniri kullanir.

SLO veya tarihsel esik Jira'da tanimli olmadigi icin bu ticket tahmini alert
esigi uretmez. OpenTelemetry exporter ve gercek servis request pipeline'i
P16 `TBP-203`; release/deployment entegrasyonu `TBP-238` kapsamina aittir.
