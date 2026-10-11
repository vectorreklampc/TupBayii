//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:tup_api/src/generated/model/para_tutari.dart';
import 'package:json_annotation/json_annotation.dart';

part 'urun_fiyati.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class UrunFiyati {
  /// Returns a new [UrunFiyati] instance.
  UrunFiyati({required this.urunId, required this.birimFiyat});

  @JsonKey(name: r'urunId', required: true, includeIfNull: false)
  final String urunId;

  @JsonKey(name: r'birimFiyat', required: true, includeIfNull: false)
  final ParaTutari birimFiyat;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is UrunFiyati &&
          other.urunId == urunId &&
          other.birimFiyat == birimFiyat;

  @override
  int get hashCode => urunId.hashCode + birimFiyat.hashCode;

  factory UrunFiyati.fromJson(Map<String, dynamic> json) =>
      _$UrunFiyatiFromJson(json);

  Map<String, dynamic> toJson() => _$UrunFiyatiToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
