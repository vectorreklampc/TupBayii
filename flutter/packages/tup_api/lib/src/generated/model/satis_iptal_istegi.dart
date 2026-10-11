//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'satis_iptal_istegi.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SatisIptalIstegi {
  /// Returns a new [SatisIptalIstegi] instance.
  SatisIptalIstegi({this.aciklama});

  @JsonKey(name: r'aciklama', required: false, includeIfNull: false)
  final String? aciklama;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SatisIptalIstegi && other.aciklama == aciklama;

  @override
  int get hashCode => aciklama.hashCode;

  factory SatisIptalIstegi.fromJson(Map<String, dynamic> json) =>
      _$SatisIptalIstegiFromJson(json);

  Map<String, dynamic> toJson() => _$SatisIptalIstegiToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
