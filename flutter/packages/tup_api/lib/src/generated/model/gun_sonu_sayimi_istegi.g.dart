// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'gun_sonu_sayimi_istegi.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

GunSonuSayimiIstegi _$GunSonuSayimiIstegiFromJson(Map<String, dynamic> json) =>
    $checkedCreate('GunSonuSayimiIstegi', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['sayilanNakitTutari']);
      final val = GunSonuSayimiIstegi(
        sayilanNakitTutari: $checkedConvert(
          'sayilanNakitTutari',
          (v) => ParaTutari.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$GunSonuSayimiIstegiToJson(
  GunSonuSayimiIstegi instance,
) => <String, dynamic>{
  'sayilanNakitTutari': instance.sayilanNakitTutari.toJson(),
};
