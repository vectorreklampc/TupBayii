// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'hata.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Hata _$HataFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Hata', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['code', 'message', 'traceId']);
      final val = Hata(
        code: $checkedConvert('code', (v) => v as String),
        message: $checkedConvert('message', (v) => v as String),
        traceId: $checkedConvert('traceId', (v) => v as String),
        details: $checkedConvert(
          'details',
          (v) => (v as List<dynamic>?)
              ?.map((e) => DogrulamaDetayi.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$HataToJson(Hata instance) => <String, dynamic>{
  'code': instance.code,
  'message': instance.message,
  'traceId': instance.traceId,
  'details': ?instance.details?.map((e) => e.toJson()).toList(),
};
