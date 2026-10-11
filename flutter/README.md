# Flutter Workspace

Bu dizin Windows/macOS masaustu ve Android/iOS mobil istemcilerinin ortak Dart Pub workspace'idir.

## Yapi

```text
flutter/
|-- apps/
|   |-- tup_desktop/       # Windows ve macOS composition root
|   `-- tup_mobile/        # Android ve iOS composition root
`-- packages/
    |-- tup_core/          # Framework bagimsiz istemci cekirdegi
    |-- tup_api/           # OpenAPI contract ve tasima siniri
    |-- tup_auth/          # Oturum ve yetki baglami
    |-- tup_design_system/ # Tasarim tokenlari ve Flutter UI bilesenleri
    |-- tup_database/      # Yerel kalicilik ve transaction siniri
    `-- tup_sync/          # Offline outbox, sync ve conflict orkestrasyonu
```

Uygulamalar yalniz composition root'tur. Is kurallari uygulama dizinlerine veya `tup_design_system` paketine yerlestirilmez. Paketler arasi bagimlilik ancak gercek bir kullanim ortaya ciktiginda ilgili `pubspec.yaml` dosyasinda acikca tanimlanir; bos iskelette spekulatif bagimlilik yoktur.

## Paket sahipligi

| Paket | Sahip oldugu alan | Sahip olmadigi alan |
| --- | --- | --- |
| `tup_core` | Framework bagimsiz ortak istemci tipleri | UI, HTTP, kalicilik ve feature is kurallari |
| `tup_api` | OpenAPI'den uretilen contract/client ve tasima uyarlamalari | Ekran state'i ve yerel veri |
| `tup_auth` | Kimlik dogrulama oturumu ve yetki baglami | Genel HTTP client ve ekran bilesenleri |
| `tup_design_system` | Token, tema ve yeniden kullanilabilir sunum bilesenleri | Domain akislari ve veri erisimi |
| `tup_database` | Yerel sema, sorgu ve transaction sahipligi | Senkronizasyon kararlari |
| `tup_sync` | Outbox, senkronizasyon ve conflict orkestrasyonu | UI ve kalicilik implementasyon ayrintilari |

## Komutlar

Komutlari bu dizinde calistir:

```powershell
flutter pub get
dart pub workspace list
cd ../contracts
npm run generate:flutter
cd ../flutter
flutter analyze
cd apps/tup_desktop
flutter test
flutter run -d windows
```

Mobil uygulama testleri `apps/tup_mobile` dizininde `flutter test` ile calistirilir.

macOS ve iOS build/run dogrulamasi ilgili Apple toolchain'i bulunan macOS ortaminda yapilir.

## Kaynaklar

- Dart Pub workspaces: https://dart.dev/tools/pub/workspaces
- Flutter CLI: https://docs.flutter.dev/reference/flutter-cli
- Flutter desktop destegi: https://docs.flutter.dev/platform-integration/desktop
