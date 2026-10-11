//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:tup_api/src/generated/model/tup_durumu.dart';
import 'package:json_annotation/json_annotation.dart';

part 'stok_duzeltme_istegi.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class StokDuzeltmeIstegi {
  /// Returns a new [StokDuzeltmeIstegi] instance.
  StokDuzeltmeIstegi({
    required this.urunId,

    required this.tupDurumu,

    required this.miktarDegisimi,

    this.aciklama,
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

  @JsonKey(name: r'miktarDegisimi', required: true, includeIfNull: false)
  final int miktarDegisimi;

  @JsonKey(name: r'aciklama', required: false, includeIfNull: false)
  final String? aciklama;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is StokDuzeltmeIstegi &&
          other.urunId == urunId &&
          other.tupDurumu == tupDurumu &&
          other.miktarDegisimi == miktarDegisimi &&
          other.aciklama == aciklama;

  @override
  int get hashCode =>
      urunId.hashCode +
      tupDurumu.hashCode +
      miktarDegisimi.hashCode +
      aciklama.hashCode;

  factory StokDuzeltmeIstegi.fromJson(Map<String, dynamic> json) =>
      _$StokDuzeltmeIstegiFromJson(json);

  Map<String, dynamic> toJson() => _$StokDuzeltmeIstegiToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
