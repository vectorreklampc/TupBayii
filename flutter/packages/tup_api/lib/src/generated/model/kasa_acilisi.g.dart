// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'kasa_acilisi.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

KasaAcilisi _$KasaAcilisiFromJson(Map<String, dynamic> json) =>
    $checkedCreate('KasaAcilisi', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['tarih', 'acilisTutari', 'acilisZamaniUtc'],
      );
      final val = KasaAcilisi(
        tarih: $checkedConvert('tarih', (v) => DateTime.parse(v as String)),
        acilisTutari: $checkedConvert(
          'acilisTutari',
          (v) => ParaTutari.fromJson(v as Map<String, dynamic>),
        ),
        acilisZamaniUtc: $checkedConvert(
          'acilisZamaniUtc',
          (v) => DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$KasaAcilisiToJson(KasaAcilisi instance) =>
    <String, dynamic>{
      'tarih': instance.tarih.toIso8601String(),
      'acilisTutari': instance.acilisTutari.toJson(),
      'acilisZamaniUtc': instance.acilisZamaniUtc.toIso8601String(),
    };
