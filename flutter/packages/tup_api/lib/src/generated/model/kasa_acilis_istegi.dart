//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:tup_api/src/generated/model/para_tutari.dart';
import 'package:json_annotation/json_annotation.dart';

part 'kasa_acilis_istegi.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class KasaAcilisIstegi {
  /// Returns a new [KasaAcilisIstegi] instance.
  KasaAcilisIstegi({required this.acilisTutari});

  @JsonKey(name: r'acilisTutari', required: true, includeIfNull: false)
  final ParaTutari acilisTutari;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is KasaAcilisIstegi && other.acilisTutari == acilisTutari;

  @override
  int get hashCode => acilisTutari.hashCode;

  factory KasaAcilisIstegi.fromJson(Map<String, dynamic> json) =>
      _$KasaAcilisIstegiFromJson(json);

  Map<String, dynamic> toJson() => _$KasaAcilisIstegiToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
