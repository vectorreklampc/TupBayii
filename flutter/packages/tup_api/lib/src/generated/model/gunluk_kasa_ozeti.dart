//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:tup_api/src/generated/model/para_tutari.dart';
import 'package:json_annotation/json_annotation.dart';

part 'gunluk_kasa_ozeti.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class GunlukKasaOzeti {
  /// Returns a new [GunlukKasaOzeti] instance.
  GunlukKasaOzeti({
    required this.tarih,

    required this.nakitToplami,

    required this.cariToplami,

    required this.satisToplami,

    required this.acilisTutari,

    required this.beklenenKasaTutari,

    required this.sayilanNakitTutari,

    required this.sayimFarki,
  });

  @JsonKey(name: r'tarih', required: true, includeIfNull: false)
  final DateTime tarih;

  /// Gunun nakit satislarinin NET toplami; iptal edilen satisin atomik ters kaydi dusulur.
  @JsonKey(name: r'nakitToplami', required: true, includeIfNull: false)
  final ParaTutari nakitToplami;

  /// Gunun cari satislarinin NET toplami; iptal edilen satisin atomik ters kaydi dusulur.
  @JsonKey(name: r'cariToplami', required: true, includeIfNull: false)
  final ParaTutari cariToplami;

  /// Gunluk satis toplami; nakitToplami + cariToplami.
  @JsonKey(name: r'satisToplami', required: true, includeIfNull: false)
  final ParaTutari satisToplami;

  /// Kasa acilisinda kaydedilen tutar.
  @JsonKey(name: r'acilisTutari', required: true, includeIfNull: false)
  final ParaTutari acilisTutari;

  /// Kasada olmasi gereken nakit; acilisTutari + nakitToplami. Cari satis kasaya nakit girisi yapmaz.
  @JsonKey(name: r'beklenenKasaTutari', required: true, includeIfNull: false)
  final ParaTutari beklenenKasaTutari;

  @JsonKey(name: r'sayilanNakitTutari', required: true, includeIfNull: true)
  final ParaTutari? sayilanNakitTutari;

  @JsonKey(name: r'sayimFarki', required: true, includeIfNull: true)
  final ParaTutari? sayimFarki;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is GunlukKasaOzeti &&
          other.tarih == tarih &&
          other.nakitToplami == nakitToplami &&
          other.cariToplami == cariToplami &&
          other.satisToplami == satisToplami &&
          other.acilisTutari == acilisTutari &&
          other.beklenenKasaTutari == beklenenKasaTutari &&
          other.sayilanNakitTutari == sayilanNakitTutari &&
          other.sayimFarki == sayimFarki;

  @override
  int get hashCode =>
      tarih.hashCode +
      nakitToplami.hashCode +
      cariToplami.hashCode +
      satisToplami.hashCode +
      acilisTutari.hashCode +
      beklenenKasaTutari.hashCode +
      (sayilanNakitTutari == null ? 0 : sayilanNakitTutari.hashCode) +
      (sayimFarki == null ? 0 : sayimFarki.hashCode);

  factory GunlukKasaOzeti.fromJson(Map<String, dynamic> json) =>
      _$GunlukKasaOzetiFromJson(json);

  Map<String, dynamic> toJson() => _$GunlukKasaOzetiToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
