// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'musteri_olusturma_istegi.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MusteriOlusturmaIstegi _$MusteriOlusturmaIstegiFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('MusteriOlusturmaIstegi', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['ad', 'telefon']);
  final val = MusteriOlusturmaIstegi(
    ad: $checkedConvert('ad', (v) => v as String),
    telefon: $checkedConvert('telefon', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$MusteriOlusturmaIstegiToJson(
  MusteriOlusturmaIstegi instance,
) => <String, dynamic>{'ad': instance.ad, 'telefon': instance.telefon};
