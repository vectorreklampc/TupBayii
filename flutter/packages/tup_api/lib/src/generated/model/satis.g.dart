// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'satis.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Satis _$SatisFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Satis', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'satisId',
          'durum',
          'odemeTuru',
          'kalemler',
          'toplamTutar',
          'stokHareketleri',
          'olusmaZamaniUtc',
        ],
      );
      final val = Satis(
        satisId: $checkedConvert('satisId', (v) => v as String),
        durum: $checkedConvert(
          'durum',
          (v) => $enumDecode(
            _$SatisDurumEnumEnumMap,
            v,
            unknownValue: SatisDurumEnum.unknownDefaultOpenApi,
          ),
        ),
        odemeTuru: $checkedConvert(
          'odemeTuru',
          (v) => $enumDecode(
            _$SatisOdemeTuruEnumEnumMap,
            v,
            unknownValue: SatisOdemeTuruEnum.unknownDefaultOpenApi,
          ),
        ),
        musteriId: $checkedConvert('musteriId', (v) => v as String?),
        kalemler: $checkedConvert(
          'kalemler',
          (v) => (v as List<dynamic>)
              .map((e) => SatisKalemiSonucu.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        toplamTutar: $checkedConvert(
          'toplamTutar',
          (v) => ParaTutari.fromJson(v as Map<String, dynamic>),
        ),
        stokHareketleri: $checkedConvert(
          'stokHareketleri',
          (v) => (v as List<dynamic>)
              .map((e) => StokHareketi.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        olusmaZamaniUtc: $checkedConvert(
          'olusmaZamaniUtc',
          (v) => DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$SatisToJson(Satis instance) => <String, dynamic>{
  'satisId': instance.satisId,
  'durum': _$SatisDurumEnumEnumMap[instance.durum]!,
  'odemeTuru': _$SatisOdemeTuruEnumEnumMap[instance.odemeTuru]!,
  'musteriId': ?instance.musteriId,
  'kalemler': instance.kalemler.map((e) => e.toJson()).toList(),
  'toplamTutar': instance.toplamTutar.toJson(),
  'stokHareketleri': instance.stokHareketleri.map((e) => e.toJson()).toList(),
  'olusmaZamaniUtc': instance.olusmaZamaniUtc.toIso8601String(),
};

const _$SatisDurumEnumEnumMap = {
  SatisDurumEnum.TAMAMLANDI: 'TAMAMLANDI',
  SatisDurumEnum.IPTAL_EDILDI: 'IPTAL_EDILDI',
  SatisDurumEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$SatisOdemeTuruEnumEnumMap = {
  SatisOdemeTuruEnum.NAKIT: 'NAKIT',
  SatisOdemeTuruEnum.CARI: 'CARI',
  SatisOdemeTuruEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};
