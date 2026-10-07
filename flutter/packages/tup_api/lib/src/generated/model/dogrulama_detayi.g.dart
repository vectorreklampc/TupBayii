// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dogrulama_detayi.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DogrulamaDetayi _$DogrulamaDetayiFromJson(Map<String, dynamic> json) =>
    $checkedCreate('DogrulamaDetayi', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['field', 'code']);
      final val = DogrulamaDetayi(
        field: $checkedConvert('field', (v) => v as String),
        code: $checkedConvert('code', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$DogrulamaDetayiToJson(DogrulamaDetayi instance) =>
    <String, dynamic>{'field': instance.field, 'code': instance.code};
