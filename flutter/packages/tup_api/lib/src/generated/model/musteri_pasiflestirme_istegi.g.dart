// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'musteri_pasiflestirme_istegi.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MusteriPasiflestirmeIstegi _$MusteriPasiflestirmeIstegiFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('MusteriPasiflestirmeIstegi', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['version']);
  final val = MusteriPasiflestirmeIstegi(
    version: $checkedConvert('version', (v) => (v as num).toInt()),
  );
  return val;
});

Map<String, dynamic> _$MusteriPasiflestirmeIstegiToJson(
  MusteriPasiflestirmeIstegi instance,
) => <String, dynamic>{'version': instance.version};
