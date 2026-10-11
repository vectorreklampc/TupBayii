// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'oturum_yaniti.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OturumYaniti _$OturumYanitiFromJson(Map<String, dynamic> json) =>
    $checkedCreate('OturumYaniti', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'oturumId',
          'accessToken',
          'tokenType',
          'sonaErmeZamaniUtc',
        ],
      );
      final val = OturumYaniti(
        oturumId: $checkedConvert('oturumId', (v) => v as String),
        accessToken: $checkedConvert('accessToken', (v) => v as String),
        tokenType: $checkedConvert(
          'tokenType',
          (v) => $enumDecode(
            _$OturumYanitiTokenTypeEnumEnumMap,
            v,
            unknownValue: OturumYanitiTokenTypeEnum.unknownDefaultOpenApi,
          ),
        ),
        sonaErmeZamaniUtc: $checkedConvert(
          'sonaErmeZamaniUtc',
          (v) => DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$OturumYanitiToJson(OturumYaniti instance) =>
    <String, dynamic>{
      'oturumId': instance.oturumId,
      'accessToken': instance.accessToken,
      'tokenType': _$OturumYanitiTokenTypeEnumEnumMap[instance.tokenType]!,
      'sonaErmeZamaniUtc': instance.sonaErmeZamaniUtc.toIso8601String(),
    };

const _$OturumYanitiTokenTypeEnumEnumMap = {
  OturumYanitiTokenTypeEnum.bearer: 'Bearer',
  OturumYanitiTokenTypeEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};
