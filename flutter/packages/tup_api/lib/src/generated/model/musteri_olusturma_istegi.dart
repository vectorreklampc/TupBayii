//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'musteri_olusturma_istegi.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MusteriOlusturmaIstegi {
  /// Returns a new [MusteriOlusturmaIstegi] instance.
  MusteriOlusturmaIstegi({required this.ad, required this.telefon});

  @JsonKey(name: r'ad', required: true, includeIfNull: false)
  final String ad;

  @JsonKey(name: r'telefon', required: true, includeIfNull: false)
  final String telefon;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is MusteriOlusturmaIstegi &&
          other.ad == ad &&
          other.telefon == telefon;

  @override
  int get hashCode => ad.hashCode + telefon.hashCode;

  factory MusteriOlusturmaIstegi.fromJson(Map<String, dynamic> json) =>
      _$MusteriOlusturmaIstegiFromJson(json);

  Map<String, dynamic> toJson() => _$MusteriOlusturmaIstegiToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
