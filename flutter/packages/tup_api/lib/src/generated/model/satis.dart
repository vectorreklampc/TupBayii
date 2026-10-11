//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:tup_api/src/generated/model/stok_hareketi.dart';
import 'package:tup_api/src/generated/model/satis_kalemi_sonucu.dart';
import 'package:tup_api/src/generated/model/para_tutari.dart';
import 'package:json_annotation/json_annotation.dart';

part 'satis.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Satis {
  /// Returns a new [Satis] instance.
  Satis({
    required this.satisId,

    required this.durum,

    required this.odemeTuru,

    this.musteriId,

    required this.kalemler,

    required this.toplamTutar,

    required this.stokHareketleri,

    required this.olusmaZamaniUtc,
  });

  @JsonKey(name: r'satisId', required: true, includeIfNull: false)
  final String satisId;

  @JsonKey(
    name: r'durum',
    required: true,
    includeIfNull: false,
    unknownEnumValue: SatisDurumEnum.unknownDefaultOpenApi,
  )
  final SatisDurumEnum durum;

  @JsonKey(
    name: r'odemeTuru',
    required: true,
    includeIfNull: false,
    unknownEnumValue: SatisOdemeTuruEnum.unknownDefaultOpenApi,
  )
  final SatisOdemeTuruEnum odemeTuru;

  @JsonKey(name: r'musteriId', required: false, includeIfNull: false)
  final String? musteriId;

  @JsonKey(name: r'kalemler', required: true, includeIfNull: false)
  final List<SatisKalemiSonucu> kalemler;

  @JsonKey(name: r'toplamTutar', required: true, includeIfNull: false)
  final ParaTutari toplamTutar;

  @JsonKey(name: r'stokHareketleri', required: true, includeIfNull: false)
  final List<StokHareketi> stokHareketleri;

  @JsonKey(name: r'olusmaZamaniUtc', required: true, includeIfNull: false)
  final DateTime olusmaZamaniUtc;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Satis &&
          other.satisId == satisId &&
          other.durum == durum &&
          other.odemeTuru == odemeTuru &&
          other.musteriId == musteriId &&
          other.kalemler == kalemler &&
          other.toplamTutar == toplamTutar &&
          other.stokHareketleri == stokHareketleri &&
          other.olusmaZamaniUtc == olusmaZamaniUtc;

  @override
  int get hashCode =>
      satisId.hashCode +
      durum.hashCode +
      odemeTuru.hashCode +
      musteriId.hashCode +
      kalemler.hashCode +
      toplamTutar.hashCode +
      stokHareketleri.hashCode +
      olusmaZamaniUtc.hashCode;

  factory Satis.fromJson(Map<String, dynamic> json) => _$SatisFromJson(json);

  Map<String, dynamic> toJson() => _$SatisToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum SatisDurumEnum {
  @JsonValue(r'TAMAMLANDI')
  TAMAMLANDI(r'TAMAMLANDI'),
  @JsonValue(r'IPTAL_EDILDI')
  IPTAL_EDILDI(r'IPTAL_EDILDI'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const SatisDurumEnum(this.value);

  final String value;

  @override
  String toString() => value;
}

enum SatisOdemeTuruEnum {
  @JsonValue(r'NAKIT')
  NAKIT(r'NAKIT'),
  @JsonValue(r'CARI')
  CARI(r'CARI'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const SatisOdemeTuruEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
