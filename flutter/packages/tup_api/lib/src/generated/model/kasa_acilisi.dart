//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:tup_api/src/generated/model/para_tutari.dart';
import 'package:json_annotation/json_annotation.dart';

part 'kasa_acilisi.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class KasaAcilisi {
  /// Returns a new [KasaAcilisi] instance.
  KasaAcilisi({
    required this.tarih,

    required this.acilisTutari,

    required this.acilisZamaniUtc,
  });

  @JsonKey(name: r'tarih', required: true, includeIfNull: false)
  final DateTime tarih;

  @JsonKey(name: r'acilisTutari', required: true, includeIfNull: false)
  final ParaTutari acilisTutari;

  @JsonKey(name: r'acilisZamaniUtc', required: true, includeIfNull: false)
  final DateTime acilisZamaniUtc;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is KasaAcilisi &&
          other.tarih == tarih &&
          other.acilisTutari == acilisTutari &&
          other.acilisZamaniUtc == acilisZamaniUtc;

  @override
  int get hashCode =>
      tarih.hashCode + acilisTutari.hashCode + acilisZamaniUtc.hashCode;

  factory KasaAcilisi.fromJson(Map<String, dynamic> json) =>
      _$KasaAcilisiFromJson(json);

  Map<String, dynamic> toJson() => _$KasaAcilisiToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
