// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'cari_odeme.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CariOdeme _$CariOdemeFromJson(Map<String, dynamic> json) =>
    $checkedCreate('CariOdeme', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['odemeTuru', 'musteriId']);
      final val = CariOdeme(
        odemeTuru: $checkedConvert(
          'odemeTuru',
          (v) => $enumDecode(
            _$CariOdemeOdemeTuruEnumEnumMap,
            v,
            unknownValue: CariOdemeOdemeTuruEnum.unknownDefaultOpenApi,
          ),
        ),
        musteriId: $checkedConvert('musteriId', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$CariOdemeToJson(CariOdeme instance) => <String, dynamic>{
  'odemeTuru': _$CariOdemeOdemeTuruEnumEnumMap[instance.odemeTuru]!,
  'musteriId': instance.musteriId,
};

const _$CariOdemeOdemeTuruEnumEnumMap = {
  CariOdemeOdemeTuruEnum.CARI: 'CARI',
  CariOdemeOdemeTuruEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};
