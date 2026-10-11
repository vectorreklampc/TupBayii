// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'satis_kalemi.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SatisKalemi _$SatisKalemiFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SatisKalemi', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['urunId', 'miktar']);
      final val = SatisKalemi(
        urunId: $checkedConvert('urunId', (v) => v as String),
        miktar: $checkedConvert('miktar', (v) => (v as num).toInt()),
        bosIadeMiktari: $checkedConvert(
          'bosIadeMiktari',
          (v) => (v as num?)?.toInt(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$SatisKalemiToJson(SatisKalemi instance) =>
    <String, dynamic>{
      'urunId': instance.urunId,
      'miktar': instance.miktar,
      'bosIadeMiktari': ?instance.bosIadeMiktari,
    };
