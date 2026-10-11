//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'musteri_pasiflestirme_istegi.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MusteriPasiflestirmeIstegi {
  /// Returns a new [MusteriPasiflestirmeIstegi] instance.
  MusteriPasiflestirmeIstegi({required this.version});

  /// Beklenen version; stale ise 409 CONCURRENCY_CONFLICT.
  // minimum: 1
  @JsonKey(name: r'version', required: true, includeIfNull: false)
  final int version;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is MusteriPasiflestirmeIstegi && other.version == version;

  @override
  int get hashCode => version.hashCode;

  factory MusteriPasiflestirmeIstegi.fromJson(Map<String, dynamic> json) =>
      _$MusteriPasiflestirmeIstegiFromJson(json);

  Map<String, dynamic> toJson() => _$MusteriPasiflestirmeIstegiToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
