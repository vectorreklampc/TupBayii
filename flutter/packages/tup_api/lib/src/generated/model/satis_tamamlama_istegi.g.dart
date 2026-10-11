// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'satis_tamamlama_istegi.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SatisTamamlamaIstegi _$SatisTamamlamaIstegiFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('SatisTamamlamaIstegi', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['kalemler', 'odeme']);
  final val = SatisTamamlamaIstegi(
    kalemler: $checkedConvert(
      'kalemler',
      (v) => (v as List<dynamic>)
          .map((e) => SatisKalemi.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    odeme: $checkedConvert(
      'odeme',
      (v) => SatisTamamlamaIstegiOdeme.fromJson(v as Map<String, dynamic>),
    ),
  );
  return val;
});

Map<String, dynamic> _$SatisTamamlamaIstegiToJson(
  SatisTamamlamaIstegi instance,
) => <String, dynamic>{
  'kalemler': instance.kalemler.map((e) => e.toJson()).toList(),
  'odeme': instance.odeme.toJson(),
};
