// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'stok_hareketi.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

StokHareketi _$StokHareketiFromJson(Map<String, dynamic> json) =>
    $checkedCreate('StokHareketi', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'stokHareketiId',
          'urunId',
          'tupDurumu',
          'miktarDegisimi',
          'hareketTuru',
          'kaynakId',
          'olusmaZamaniUtc',
        ],
      );
      final val = StokHareketi(
        stokHareketiId: $checkedConvert('stokHareketiId', (v) => v as String),
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
        hareketTuru: $checkedConvert(
          'hareketTuru',
          (v) => $enumDecode(
            _$StokHareketiHareketTuruEnumEnumMap,
            v,
            unknownValue: StokHareketiHareketTuruEnum.unknownDefaultOpenApi,
          ),
        ),
        kaynakId: $checkedConvert('kaynakId', (v) => v as String),
        olusmaZamaniUtc: $checkedConvert(
          'olusmaZamaniUtc',
          (v) => DateTime.parse(v as String),
        ),
      );
      return val;
    });

Map<String, dynamic> _$StokHareketiToJson(
  StokHareketi instance,
) => <String, dynamic>{
  'stokHareketiId': instance.stokHareketiId,
  'urunId': instance.urunId,
  'tupDurumu': _$TupDurumuEnumMap[instance.tupDurumu]!,
  'miktarDegisimi': instance.miktarDegisimi,
  'hareketTuru': _$StokHareketiHareketTuruEnumEnumMap[instance.hareketTuru]!,
  'kaynakId': instance.kaynakId,
  'olusmaZamaniUtc': instance.olusmaZamaniUtc.toIso8601String(),
};

const _$TupDurumuEnumMap = {
  TupDurumu.FULL: 'FULL',
  TupDurumu.EMPTY: 'EMPTY',
  TupDurumu.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$StokHareketiHareketTuruEnumEnumMap = {
  StokHareketiHareketTuruEnum.SATIS: 'SATIS',
  StokHareketiHareketTuruEnum.SATIS_IPTALI: 'SATIS_IPTALI',
  StokHareketiHareketTuruEnum.BOS_IADE: 'BOS_IADE',
  StokHareketiHareketTuruEnum.DUZELTME: 'DUZELTME',
  StokHareketiHareketTuruEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};
