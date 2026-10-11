// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'gunluk_kasa_ozeti.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

GunlukKasaOzeti _$GunlukKasaOzetiFromJson(Map<String, dynamic> json) =>
    $checkedCreate('GunlukKasaOzeti', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'tarih',
          'nakitToplami',
          'cariToplami',
          'satisToplami',
          'acilisTutari',
          'beklenenKasaTutari',
          'sayilanNakitTutari',
          'sayimFarki',
        ],
      );
      final val = GunlukKasaOzeti(
        tarih: $checkedConvert('tarih', (v) => DateTime.parse(v as String)),
        nakitToplami: $checkedConvert(
          'nakitToplami',
          (v) => ParaTutari.fromJson(v as Map<String, dynamic>),
        ),
        cariToplami: $checkedConvert(
          'cariToplami',
          (v) => ParaTutari.fromJson(v as Map<String, dynamic>),
        ),
        satisToplami: $checkedConvert(
          'satisToplami',
          (v) => ParaTutari.fromJson(v as Map<String, dynamic>),
        ),
        acilisTutari: $checkedConvert(
          'acilisTutari',
          (v) => ParaTutari.fromJson(v as Map<String, dynamic>),
        ),
        beklenenKasaTutari: $checkedConvert(
          'beklenenKasaTutari',
          (v) => ParaTutari.fromJson(v as Map<String, dynamic>),
        ),
        sayilanNakitTutari: $checkedConvert(
          'sayilanNakitTutari',
          (v) =>
              v == null ? null : ParaTutari.fromJson(v as Map<String, dynamic>),
        ),
        sayimFarki: $checkedConvert(
          'sayimFarki',
          (v) =>
              v == null ? null : ParaTutari.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$GunlukKasaOzetiToJson(GunlukKasaOzeti instance) =>
    <String, dynamic>{
      'tarih': instance.tarih.toIso8601String(),
      'nakitToplami': instance.nakitToplami.toJson(),
      'cariToplami': instance.cariToplami.toJson(),
      'satisToplami': instance.satisToplami.toJson(),
      'acilisTutari': instance.acilisTutari.toJson(),
      'beklenenKasaTutari': instance.beklenenKasaTutari.toJson(),
      'sayilanNakitTutari': instance.sayilanNakitTutari?.toJson(),
      'sayimFarki': instance.sayimFarki?.toJson(),
    };
