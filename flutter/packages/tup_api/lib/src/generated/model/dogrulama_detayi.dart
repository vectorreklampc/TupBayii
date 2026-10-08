//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'dogrulama_detayi.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DogrulamaDetayi {
  /// Returns a new [DogrulamaDetayi] instance.
  DogrulamaDetayi({required this.field, required this.code});

  @JsonKey(name: r'field', required: true, includeIfNull: false)
  final String field;

  @JsonKey(name: r'code', required: true, includeIfNull: false)
  final String code;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is DogrulamaDetayi && other.field == field && other.code == code;

  @override
  int get hashCode => field.hashCode + code.hashCode;

  factory DogrulamaDetayi.fromJson(Map<String, dynamic> json) =>
      _$DogrulamaDetayiFromJson(json);

  Map<String, dynamic> toJson() => _$DogrulamaDetayiToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
