//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:tup_api/src/generated/model/para_tutari.dart';
import 'package:json_annotation/json_annotation.dart';

part 'gun_sonu_sayimi.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class GunSonuSayimi {
  /// Returns a new [GunSonuSayimi] instance.
  GunSonuSayimi({
    required this.tarih,

    required this.sayilanNakitTutari,

    required this.kayitZamaniUtc,
  });

  @JsonKey(name: r'tarih', required: true, includeIfNull: false)
  final DateTime tarih;

  @JsonKey(name: r'sayilanNakitTutari', required: true, includeIfNull: false)
  final ParaTutari sayilanNakitTutari;

  @JsonKey(name: r'kayitZamaniUtc', required: true, includeIfNull: false)
  final DateTime kayitZamaniUtc;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is GunSonuSayimi &&
          other.tarih == tarih &&
          other.sayilanNakitTutari == sayilanNakitTutari &&
          other.kayitZamaniUtc == kayitZamaniUtc;

  @override
  int get hashCode =>
      tarih.hashCode + sayilanNakitTutari.hashCode + kayitZamaniUtc.hashCode;

  factory GunSonuSayimi.fromJson(Map<String, dynamic> json) =>
      _$GunSonuSayimiFromJson(json);

  Map<String, dynamic> toJson() => _$GunSonuSayimiToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
