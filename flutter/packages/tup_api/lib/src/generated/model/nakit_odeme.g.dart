// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'nakit_odeme.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NakitOdeme _$NakitOdemeFromJson(Map<String, dynamic> json) =>
    $checkedCreate('NakitOdeme', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['odemeTuru']);
      final val = NakitOdeme(
        odemeTuru: $checkedConvert(
          'odemeTuru',
          (v) => $enumDecode(
            _$NakitOdemeOdemeTuruEnumEnumMap,
            v,
            unknownValue: NakitOdemeOdemeTuruEnum.unknownDefaultOpenApi,
          ),
        ),
      );
      return val;
    });

Map<String, dynamic> _$NakitOdemeToJson(NakitOdeme instance) =>
    <String, dynamic>{
      'odemeTuru': _$NakitOdemeOdemeTuruEnumEnumMap[instance.odemeTuru]!,
    };

const _$NakitOdemeOdemeTuruEnumEnumMap = {
  NakitOdemeOdemeTuruEnum.NAKIT: 'NAKIT',
  NakitOdemeOdemeTuruEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};
