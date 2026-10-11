// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'kasa_acilis_istegi.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

KasaAcilisIstegi _$KasaAcilisIstegiFromJson(Map<String, dynamic> json) =>
    $checkedCreate('KasaAcilisIstegi', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['acilisTutari']);
      final val = KasaAcilisIstegi(
        acilisTutari: $checkedConvert(
          'acilisTutari',
          (v) => ParaTutari.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$KasaAcilisIstegiToJson(KasaAcilisIstegi instance) =>
    <String, dynamic>{'acilisTutari': instance.acilisTutari.toJson()};
