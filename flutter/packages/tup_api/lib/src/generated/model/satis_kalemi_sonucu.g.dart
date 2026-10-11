// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'satis_kalemi_sonucu.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SatisKalemiSonucu _$SatisKalemiSonucuFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SatisKalemiSonucu', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'urunId',
          'miktar',
          'bosIadeMiktari',
          'birimFiyat',
          'tutar',
        ],
      );
      final val = SatisKalemiSonucu(
        urunId: $checkedConvert('urunId', (v) => v as String),
        miktar: $checkedConvert('miktar', (v) => (v as num).toInt()),
        bosIadeMiktari: $checkedConvert(
          'bosIadeMiktari',
          (v) => (v as num).toInt(),
        ),
        birimFiyat: $checkedConvert(
          'birimFiyat',
          (v) => ParaTutari.fromJson(v as Map<String, dynamic>),
        ),
        tutar: $checkedConvert(
          'tutar',
          (v) => ParaTutari.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$SatisKalemiSonucuToJson(SatisKalemiSonucu instance) =>
    <String, dynamic>{
      'urunId': instance.urunId,
      'miktar': instance.miktar,
      'bosIadeMiktari': instance.bosIadeMiktari,
      'birimFiyat': instance.birimFiyat.toJson(),
      'tutar': instance.tutar.toJson(),
    };
