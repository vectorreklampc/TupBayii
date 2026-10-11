//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:tup_api/src/generated/model/tup_durumu.dart';
import 'package:json_annotation/json_annotation.dart';

part 'stok_hareketi.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class StokHareketi {
  /// Returns a new [StokHareketi] instance.
  StokHareketi({
    required this.stokHareketiId,

    required this.urunId,

    required this.tupDurumu,

    required this.miktarDegisimi,

    required this.hareketTuru,

    required this.kaynakId,

    required this.olusmaZamaniUtc,
  });

  @JsonKey(name: r'stokHareketiId', required: true, includeIfNull: false)
  final String stokHareketiId;

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

  @JsonKey(
    name: r'hareketTuru',
    required: true,
    includeIfNull: false,
    unknownEnumValue: StokHareketiHareketTuruEnum.unknownDefaultOpenApi,
  )
  final StokHareketiHareketTuruEnum hareketTuru;

  @JsonKey(name: r'kaynakId', required: true, includeIfNull: false)
  final String kaynakId;

  @JsonKey(name: r'olusmaZamaniUtc', required: true, includeIfNull: false)
  final DateTime olusmaZamaniUtc;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is StokHareketi &&
          other.stokHareketiId == stokHareketiId &&
          other.urunId == urunId &&
          other.tupDurumu == tupDurumu &&
          other.miktarDegisimi == miktarDegisimi &&
          other.hareketTuru == hareketTuru &&
          other.kaynakId == kaynakId &&
          other.olusmaZamaniUtc == olusmaZamaniUtc;

  @override
  int get hashCode =>
      stokHareketiId.hashCode +
      urunId.hashCode +
      tupDurumu.hashCode +
      miktarDegisimi.hashCode +
      hareketTuru.hashCode +
      kaynakId.hashCode +
      olusmaZamaniUtc.hashCode;

  factory StokHareketi.fromJson(Map<String, dynamic> json) =>
      _$StokHareketiFromJson(json);

  Map<String, dynamic> toJson() => _$StokHareketiToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum StokHareketiHareketTuruEnum {
  @JsonValue(r'SATIS')
  SATIS(r'SATIS'),
  @JsonValue(r'SATIS_IPTALI')
  SATIS_IPTALI(r'SATIS_IPTALI'),
  @JsonValue(r'BOS_IADE')
  BOS_IADE(r'BOS_IADE'),
  @JsonValue(r'DUZELTME')
  DUZELTME(r'DUZELTME'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const StokHareketiHareketTuruEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
