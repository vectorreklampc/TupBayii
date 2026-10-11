//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'satis_kalemi.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SatisKalemi {
  /// Returns a new [SatisKalemi] instance.
  SatisKalemi({
    required this.urunId,

    required this.miktar,

    this.bosIadeMiktari,
  });

  @JsonKey(name: r'urunId', required: true, includeIfNull: false)
  final String urunId;

  /// Satilan FULL adet.
  // minimum: 1
  @JsonKey(name: r'miktar', required: true, includeIfNull: false)
  final int miktar;

  /// Iade alinan EMPTY adet.
  // minimum: 0
  @JsonKey(name: r'bosIadeMiktari', required: false, includeIfNull: false)
  final int? bosIadeMiktari;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SatisKalemi &&
          other.urunId == urunId &&
          other.miktar == miktar &&
          other.bosIadeMiktari == bosIadeMiktari;

  @override
  int get hashCode =>
      urunId.hashCode + miktar.hashCode + bosIadeMiktari.hashCode;

  factory SatisKalemi.fromJson(Map<String, dynamic> json) =>
      _$SatisKalemiFromJson(json);

  Map<String, dynamic> toJson() => _$SatisKalemiToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
