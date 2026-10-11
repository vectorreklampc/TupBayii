// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'urun.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Urun _$UrunFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Urun', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['urunId', 'ad']);
      final val = Urun(
        urunId: $checkedConvert('urunId', (v) => v as String),
        ad: $checkedConvert('ad', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$UrunToJson(Urun instance) => <String, dynamic>{
  'urunId': instance.urunId,
  'ad': instance.ad,
};
