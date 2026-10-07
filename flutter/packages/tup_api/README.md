# tup_api

OpenAPI'den uretilen typed contract/client ile tasima uyarlamalarinin siniridir. Elle tekrarlanan HTTP contract'lari veya ekran state'i burada tutulmaz.

Kanonik `contracts/openapi.json` degistiginde depo kokunden asagidaki komut calistirilir:

```powershell
cd contracts
npm run generate:flutter
```

Komut, digest ile sabitlenmis OpenAPI Generator 7.17.0 image'ini kullanir; `lib/src/generated` ile `lib/tup_api.dart` dosyalarini yeniler, serialization kodunu uretir ve Dart formatlamasini uygular. Docker, Node.js ve Dart araclari gereklidir. Uretilen dosyalar elle degistirilmez.

Contract henuz kalici bir server URL'i tanimlamadigi icin istemci calisma adresi composition root'ta verilir. Yerel mock server ornegi:

```dart
final api = TupApi(basePathOverride: 'http://localhost:4010');
```
