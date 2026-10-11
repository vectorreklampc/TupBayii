// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'satis_tamamlama_istegi_odeme.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SatisTamamlamaIstegiOdeme _$SatisTamamlamaIstegiOdemeFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('SatisTamamlamaIstegiOdeme', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['odemeTuru', 'musteriId']);
  final val = SatisTamamlamaIstegiOdeme(
    odemeTuru: $checkedConvert(
      'odemeTuru',
      (v) => $enumDecode(
        _$SatisTamamlamaIstegiOdemeOdemeTuruEnumEnumMap,
        v,
        unknownValue:
            SatisTamamlamaIstegiOdemeOdemeTuruEnum.unknownDefaultOpenApi,
      ),
    ),
    musteriId: $checkedConvert('musteriId', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$SatisTamamlamaIstegiOdemeToJson(
  SatisTamamlamaIstegiOdeme instance,
) => <String, dynamic>{
  'odemeTuru':
      _$SatisTamamlamaIstegiOdemeOdemeTuruEnumEnumMap[instance.odemeTuru]!,
  'musteriId': instance.musteriId,
};

const _$SatisTamamlamaIstegiOdemeOdemeTuruEnumEnumMap = {
  SatisTamamlamaIstegiOdemeOdemeTuruEnum.CARI: 'CARI',
  SatisTamamlamaIstegiOdemeOdemeTuruEnum.unknownDefaultOpenApi:
      'unknown_default_open_api',
};
