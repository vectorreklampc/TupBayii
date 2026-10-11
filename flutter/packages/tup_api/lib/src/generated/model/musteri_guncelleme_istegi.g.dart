// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'musteri_guncelleme_istegi.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MusteriGuncellemeIstegi _$MusteriGuncellemeIstegiFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('MusteriGuncellemeIstegi', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['version']);
  final val = MusteriGuncellemeIstegi(
    version: $checkedConvert('version', (v) => (v as num).toInt()),
    ad: $checkedConvert('ad', (v) => v as String?),
    telefon: $checkedConvert('telefon', (v) => v as String?),
  );
  return val;
});

Map<String, dynamic> _$MusteriGuncellemeIstegiToJson(
  MusteriGuncellemeIstegi instance,
) => <String, dynamic>{
  'version': instance.version,
  'ad': ?instance.ad,
  'telefon': ?instance.telefon,
};
