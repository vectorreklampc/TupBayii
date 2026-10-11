// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'stok_duzeltme_istegi.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

StokDuzeltmeIstegi _$StokDuzeltmeIstegiFromJson(Map<String, dynamic> json) =>
    $checkedCreate('StokDuzeltmeIstegi', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['urunId', 'tupDurumu', 'miktarDegisimi'],
      );
      final val = StokDuzeltmeIstegi(
        urunId: $checkedConvert('urunId', (v) => v as String),
        tupDurumu: $checkedConvert(
          'tupDurumu',
          (v) => $enumDecode(
            _$TupDurumuEnumMap,
            v,
            unknownValue: TupDurumu.unknownDefaultOpenApi,
          ),
        ),
        miktarDegisimi: $checkedConvert(
          'miktarDegisimi',
          (v) => (v as num).toInt(),
        ),
        aciklama: $checkedConvert('aciklama', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$StokDuzeltmeIstegiToJson(StokDuzeltmeIstegi instance) =>
    <String, dynamic>{
      'urunId': instance.urunId,
      'tupDurumu': _$TupDurumuEnumMap[instance.tupDurumu]!,
      'miktarDegisimi': instance.miktarDegisimi,
      'aciklama': ?instance.aciklama,
    };

const _$TupDurumuEnumMap = {
  TupDurumu.FULL: 'FULL',
  TupDurumu.EMPTY: 'EMPTY',
  TupDurumu.unknownDefaultOpenApi: 'unknown_default_open_api',
};
