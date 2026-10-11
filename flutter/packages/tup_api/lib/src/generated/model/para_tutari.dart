//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'para_tutari.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ParaTutari {
  /// Returns a new [ParaTutari] instance.
  ParaTutari({required this.tutar, required this.paraBirimi});

  /// Iki ondalikli decimal metin.
  @JsonKey(name: r'tutar', required: true, includeIfNull: false)
  final String tutar;

  /// ISO 4217 kodu.
  @JsonKey(name: r'paraBirimi', required: true, includeIfNull: false)
  final String paraBirimi;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ParaTutari &&
          other.tutar == tutar &&
          other.paraBirimi == paraBirimi;

  @override
  int get hashCode => tutar.hashCode + paraBirimi.hashCode;

  factory ParaTutari.fromJson(Map<String, dynamic> json) =>
      _$ParaTutariFromJson(json);

  Map<String, dynamic> toJson() => _$ParaTutariToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
