// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'stok_kalemi.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

StokKalemi _$StokKalemiFromJson(Map<String, dynamic> json) =>
    $checkedCreate('StokKalemi', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['urunId', 'tupDurumu', 'miktar']);
      final val = StokKalemi(
        urunId: $checkedConvert('urunId', (v) => v as String),
        tupDurumu: $checkedConvert(
          'tupDurumu',
          (v) => $enumDecode(
            _$TupDurumuEnumMap,
            v,
            unknownValue: TupDurumu.unknownDefaultOpenApi,
          ),
        ),
        miktar: $checkedConvert('miktar', (v) => (v as num).toInt()),
      );
      return val;
    });

Map<String, dynamic> _$StokKalemiToJson(StokKalemi instance) =>
    <String, dynamic>{
      'urunId': instance.urunId,
      'tupDurumu': _$TupDurumuEnumMap[instance.tupDurumu]!,
      'miktar': instance.miktar,
    };

const _$TupDurumuEnumMap = {
  TupDurumu.FULL: 'FULL',
  TupDurumu.EMPTY: 'EMPTY',
  TupDurumu.unknownDefaultOpenApi: 'unknown_default_open_api',
};
