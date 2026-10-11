//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'urun.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Urun {
  /// Returns a new [Urun] instance.
  Urun({required this.urunId, required this.ad});

  @JsonKey(name: r'urunId', required: true, includeIfNull: false)
  final String urunId;

  @JsonKey(name: r'ad', required: true, includeIfNull: false)
  final String ad;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Urun && other.urunId == urunId && other.ad == ad;

  @override
  int get hashCode => urunId.hashCode + ad.hashCode;

  factory Urun.fromJson(Map<String, dynamic> json) => _$UrunFromJson(json);

  Map<String, dynamic> toJson() => _$UrunToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
