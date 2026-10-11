// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'musteri.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Musteri _$MusteriFromJson(Map<String, dynamic> json) => $checkedCreate(
  'Musteri',
  json,
  ($checkedConvert) {
    $checkKeys(
      json,
      requiredKeys: const ['musteriId', 'ad', 'telefon', 'aktifMi', 'version'],
    );
    final val = Musteri(
      musteriId: $checkedConvert('musteriId', (v) => v as String),
      ad: $checkedConvert('ad', (v) => v as String),
      telefon: $checkedConvert('telefon', (v) => v as String),
      aktifMi: $checkedConvert('aktifMi', (v) => v as bool),
      version: $checkedConvert('version', (v) => (v as num).toInt()),
    );
    return val;
  },
);

Map<String, dynamic> _$MusteriToJson(Musteri instance) => <String, dynamic>{
  'musteriId': instance.musteriId,
  'ad': instance.ad,
  'telefon': instance.telefon,
  'aktifMi': instance.aktifMi,
  'version': instance.version,
};
