//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'musteri_guncelleme_istegi.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MusteriGuncellemeIstegi {
  /// Returns a new [MusteriGuncellemeIstegi] instance.
  MusteriGuncellemeIstegi({required this.version, this.ad, this.telefon});

  /// Beklenen version; stale ise 409 CONCURRENCY_CONFLICT.
  // minimum: 1
  @JsonKey(name: r'version', required: true, includeIfNull: false)
  final int version;

  @JsonKey(name: r'ad', required: false, includeIfNull: false)
  final String? ad;

  @JsonKey(name: r'telefon', required: false, includeIfNull: false)
  final String? telefon;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is MusteriGuncellemeIstegi &&
          other.version == version &&
          other.ad == ad &&
          other.telefon == telefon;

  @override
  int get hashCode => version.hashCode + ad.hashCode + telefon.hashCode;

  factory MusteriGuncellemeIstegi.fromJson(Map<String, dynamic> json) =>
      _$MusteriGuncellemeIstegiFromJson(json);

  Map<String, dynamic> toJson() => _$MusteriGuncellemeIstegiToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
