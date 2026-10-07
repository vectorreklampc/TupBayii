//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:tup_api/src/generated/model/dogrulama_detayi.dart';
import 'package:json_annotation/json_annotation.dart';

part 'hata.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Hata {
  /// Returns a new [Hata] instance.
  Hata({
    required this.code,

    required this.message,

    required this.traceId,

    this.details,
  });

  @JsonKey(name: r'code', required: true, includeIfNull: false)
  final String code;

  @JsonKey(name: r'message', required: true, includeIfNull: false)
  final String message;

  @JsonKey(name: r'traceId', required: true, includeIfNull: false)
  final String traceId;

  @JsonKey(name: r'details', required: false, includeIfNull: false)
  final List<DogrulamaDetayi>? details;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Hata &&
          other.code == code &&
          other.message == message &&
          other.traceId == traceId &&
          other.details == details;

  @override
  int get hashCode =>
      code.hashCode + message.hashCode + traceId.hashCode + details.hashCode;

  factory Hata.fromJson(Map<String, dynamic> json) => _$HataFromJson(json);

  Map<String, dynamic> toJson() => _$HataToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
