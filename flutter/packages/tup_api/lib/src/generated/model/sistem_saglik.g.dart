// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sistem_saglik.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SistemSaglik _$SistemSaglikFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SistemSaglik', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'status',
          'service',
          'apiVersion',
          'timestampUtc',
          'traceId',
        ],
      );
      final val = SistemSaglik(
        status: $checkedConvert(
          'status',
          (v) => $enumDecode(
            _$SistemSaglikStatusEnumEnumMap,
            v,
            unknownValue: SistemSaglikStatusEnum.unknownDefaultOpenApi,
          ),
        ),
        service: $checkedConvert('service', (v) => v as String),
        apiVersion: $checkedConvert('apiVersion', (v) => v as String),
        timestampUtc: $checkedConvert(
          'timestampUtc',
          (v) => DateTime.parse(v as String),
        ),
        traceId: $checkedConvert('traceId', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$SistemSaglikToJson(SistemSaglik instance) =>
    <String, dynamic>{
      'status': _$SistemSaglikStatusEnumEnumMap[instance.status]!,
      'service': instance.service,
      'apiVersion': instance.apiVersion,
      'timestampUtc': instance.timestampUtc.toIso8601String(),
      'traceId': instance.traceId,
    };

const _$SistemSaglikStatusEnumEnumMap = {
  SistemSaglikStatusEnum.ok: 'ok',
  SistemSaglikStatusEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};
