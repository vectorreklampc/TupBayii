//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:tup_api/src/generated/model/para_tutari.dart';
import 'package:json_annotation/json_annotation.dart';

part 'satis_kalemi_sonucu.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SatisKalemiSonucu {
  /// Returns a new [SatisKalemiSonucu] instance.
  SatisKalemiSonucu({
    required this.urunId,

    required this.miktar,

    required this.bosIadeMiktari,

    required this.birimFiyat,

    required this.tutar,
  });

  @JsonKey(name: r'urunId', required: true, includeIfNull: false)
  final String urunId;

  // minimum: 1
  @JsonKey(name: r'miktar', required: true, includeIfNull: false)
  final int miktar;

  // minimum: 0
  @JsonKey(name: r'bosIadeMiktari', required: true, includeIfNull: false)
  final int bosIadeMiktari;

  @JsonKey(name: r'birimFiyat', required: true, includeIfNull: false)
  final ParaTutari birimFiyat;

  @JsonKey(name: r'tutar', required: true, includeIfNull: false)
  final ParaTutari tutar;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SatisKalemiSonucu &&
          other.urunId == urunId &&
          other.miktar == miktar &&
          other.bosIadeMiktari == bosIadeMiktari &&
          other.birimFiyat == birimFiyat &&
          other.tutar == tutar;

  @override
  int get hashCode =>
      urunId.hashCode +
      miktar.hashCode +
      bosIadeMiktari.hashCode +
      birimFiyat.hashCode +
      tutar.hashCode;

  factory SatisKalemiSonucu.fromJson(Map<String, dynamic> json) =>
      _$SatisKalemiSonucuFromJson(json);

  Map<String, dynamic> toJson() => _$SatisKalemiSonucuToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
