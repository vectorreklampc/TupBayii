//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'sistem_saglik.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SistemSaglik {
  /// Returns a new [SistemSaglik] instance.
  SistemSaglik({
    required this.status,

    required this.service,

    required this.apiVersion,

    required this.timestampUtc,

    required this.traceId,
  });

  @JsonKey(
    name: r'status',
    required: true,
    includeIfNull: false,
    unknownEnumValue: SistemSaglikStatusEnum.unknownDefaultOpenApi,
  )
  final SistemSaglikStatusEnum status;

  @JsonKey(name: r'service', required: true, includeIfNull: false)
  final String service;

  @JsonKey(name: r'apiVersion', required: true, includeIfNull: false)
  final String apiVersion;

  @JsonKey(name: r'timestampUtc', required: true, includeIfNull: false)
  final DateTime timestampUtc;

  @JsonKey(name: r'traceId', required: true, includeIfNull: false)
  final String traceId;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SistemSaglik &&
          other.status == status &&
          other.service == service &&
          other.apiVersion == apiVersion &&
          other.timestampUtc == timestampUtc &&
          other.traceId == traceId;

  @override
  int get hashCode =>
      status.hashCode +
      service.hashCode +
      apiVersion.hashCode +
      timestampUtc.hashCode +
      traceId.hashCode;

  factory SistemSaglik.fromJson(Map<String, dynamic> json) =>
      _$SistemSaglikFromJson(json);

  Map<String, dynamic> toJson() => _$SistemSaglikToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum SistemSaglikStatusEnum {
  @JsonValue(r'ok')
  ok(r'ok'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const SistemSaglikStatusEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
