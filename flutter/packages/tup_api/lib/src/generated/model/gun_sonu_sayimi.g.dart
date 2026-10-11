// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'gun_sonu_sayimi.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

GunSonuSayimi _$GunSonuSayimiFromJson(Map<String, dynamic> json) =>
    $checkedCreate('GunSonuSayimi', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['tarih', 'sayilanNakitTutari', 'kayitZamaniUtc'],
      );
      final val = GunSonuSayimi(
        tarih: $checkedConvert('tarih', (v) => DateTime.parse(v as String)),
        sayilanNakitTutari: $checkedConvert(
          'sayilanNakitTutari',
          (v) => ParaTutari.fromJson(v as Map<String, dynamic>),
        ),
        kayitZamaniUtc: $checkedConvert(
          'kayitZamaniUtc',
          (v) => DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$GunSonuSayimiToJson(GunSonuSayimi instance) =>
    <String, dynamic>{
      'tarih': instance.tarih.toIso8601String(),
      'sayilanNakitTutari': instance.sayilanNakitTutari.toJson(),
      'kayitZamaniUtc': instance.kayitZamaniUtc.toIso8601String(),
    };
