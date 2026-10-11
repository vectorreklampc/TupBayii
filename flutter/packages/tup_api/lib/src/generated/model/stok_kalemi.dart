//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:tup_api/src/generated/model/tup_durumu.dart';
import 'package:json_annotation/json_annotation.dart';

part 'stok_kalemi.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class StokKalemi {
  /// Returns a new [StokKalemi] instance.
  StokKalemi({
    required this.urunId,

    required this.tupDurumu,

    required this.miktar,
  });

  @JsonKey(name: r'urunId', required: true, includeIfNull: false)
  final String urunId;

  @JsonKey(
    name: r'tupDurumu',
    required: true,
    includeIfNull: false,
    unknownEnumValue: TupDurumu.unknownDefaultOpenApi,
  )
  final TupDurumu tupDurumu;

  // minimum: 0
  @JsonKey(name: r'miktar', required: true, includeIfNull: false)
  final int miktar;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is StokKalemi &&
          other.urunId == urunId &&
          other.tupDurumu == tupDurumu &&
          other.miktar == miktar;

  @override
  int get hashCode => urunId.hashCode + tupDurumu.hashCode + miktar.hashCode;

  factory StokKalemi.fromJson(Map<String, dynamic> json) =>
      _$StokKalemiFromJson(json);

  Map<String, dynamic> toJson() => _$StokKalemiToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
