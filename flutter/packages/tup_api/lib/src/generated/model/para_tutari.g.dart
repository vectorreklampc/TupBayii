// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'para_tutari.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ParaTutari _$ParaTutariFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ParaTutari', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['tutar', 'paraBirimi']);
      final val = ParaTutari(
        tutar: $checkedConvert('tutar', (v) => v as String),
        paraBirimi: $checkedConvert('paraBirimi', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$ParaTutariToJson(ParaTutari instance) =>
    <String, dynamic>{
      'tutar': instance.tutar,
      'paraBirimi': instance.paraBirimi,
    };
