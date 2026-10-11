// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'urun_fiyati.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UrunFiyati _$UrunFiyatiFromJson(Map<String, dynamic> json) =>
    $checkedCreate('UrunFiyati', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['urunId', 'birimFiyat']);
      final val = UrunFiyati(
        urunId: $checkedConvert('urunId', (v) => v as String),
        birimFiyat: $checkedConvert(
          'birimFiyat',
          (v) => ParaTutari.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$UrunFiyatiToJson(UrunFiyati instance) =>
    <String, dynamic>{
      'urunId': instance.urunId,
      'birimFiyat': instance.birimFiyat.toJson(),
    };
