// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'oturum_sonlandirma_sonucu.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

OturumSonlandirmaSonucu _$OturumSonlandirmaSonucuFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('OturumSonlandirmaSonucu', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['oturumId', 'sonlandirmaZamaniUtc']);
  final val = OturumSonlandirmaSonucu(
    oturumId: $checkedConvert('oturumId', (v) => v as String),
    sonlandirmaZamaniUtc: $checkedConvert(
      'sonlandirmaZamaniUtc',
      (v) => DateTime.parse(v as String),
    ),
  );
  return val;
});

Map<String, dynamic> _$OturumSonlandirmaSonucuToJson(
  OturumSonlandirmaSonucu instance,
) => <String, dynamic>{
  'oturumId': instance.oturumId,
  'sonlandirmaZamaniUtc': instance.sonlandirmaZamaniUtc.toIso8601String(),
};
