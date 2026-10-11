// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'oturum_acma_istegi.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OturumAcmaIstegi _$OturumAcmaIstegiFromJson(Map<String, dynamic> json) =>
    $checkedCreate('OturumAcmaIstegi', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['kullaniciAdi', 'parola']);
      final val = OturumAcmaIstegi(
        kullaniciAdi: $checkedConvert('kullaniciAdi', (v) => v as String),
        parola: $checkedConvert('parola', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$OturumAcmaIstegiToJson(OturumAcmaIstegi instance) =>
    <String, dynamic>{
      'kullaniciAdi': instance.kullaniciAdi,
      'parola': instance.parola,
    };
