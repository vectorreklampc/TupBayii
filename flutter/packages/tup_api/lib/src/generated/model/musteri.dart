//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'musteri.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Musteri {
  /// Returns a new [Musteri] instance.
  Musteri({
    required this.musteriId,

    required this.ad,

    required this.telefon,

    required this.aktifMi,

    required this.version,
  });

  @JsonKey(name: r'musteriId', required: true, includeIfNull: false)
  final String musteriId;

  @JsonKey(name: r'ad', required: true, includeIfNull: false)
  final String ad;

  @JsonKey(name: r'telefon', required: true, includeIfNull: false)
  final String telefon;

  @JsonKey(name: r'aktifMi', required: true, includeIfNull: false)
  final bool aktifMi;

  // minimum: 1
  @JsonKey(name: r'version', required: true, includeIfNull: false)
  final int version;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Musteri &&
          other.musteriId == musteriId &&
          other.ad == ad &&
          other.telefon == telefon &&
          other.aktifMi == aktifMi &&
          other.version == version;

  @override
  int get hashCode =>
      musteriId.hashCode +
      ad.hashCode +
      telefon.hashCode +
      aktifMi.hashCode +
      version.hashCode;

  factory Musteri.fromJson(Map<String, dynamic> json) =>
      _$MusteriFromJson(json);

  Map<String, dynamic> toJson() => _$MusteriToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
