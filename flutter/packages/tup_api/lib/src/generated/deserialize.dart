import 'package:tup_api/src/generated/model/cari_odeme.dart';
import 'package:tup_api/src/generated/model/dogrulama_detayi.dart';
import 'package:tup_api/src/generated/model/gun_sonu_sayimi.dart';
import 'package:tup_api/src/generated/model/gun_sonu_sayimi_istegi.dart';
import 'package:tup_api/src/generated/model/gunluk_kasa_ozeti.dart';
import 'package:tup_api/src/generated/model/hata.dart';
import 'package:tup_api/src/generated/model/kasa_acilis_istegi.dart';
import 'package:tup_api/src/generated/model/kasa_acilisi.dart';
import 'package:tup_api/src/generated/model/list_products200_response.dart';
import 'package:tup_api/src/generated/model/list_stock200_response.dart';
import 'package:tup_api/src/generated/model/list_stock_movements200_response.dart';
import 'package:tup_api/src/generated/model/musteri.dart';
import 'package:tup_api/src/generated/model/musteri_guncelleme_istegi.dart';
import 'package:tup_api/src/generated/model/musteri_olusturma_istegi.dart';
import 'package:tup_api/src/generated/model/musteri_pasiflestirme_istegi.dart';
import 'package:tup_api/src/generated/model/nakit_odeme.dart';
import 'package:tup_api/src/generated/model/oturum_acma_istegi.dart';
import 'package:tup_api/src/generated/model/oturum_sonlandirma_sonucu.dart';
import 'package:tup_api/src/generated/model/oturum_yaniti.dart';
import 'package:tup_api/src/generated/model/para_tutari.dart';
import 'package:tup_api/src/generated/model/satis.dart';
import 'package:tup_api/src/generated/model/satis_iptal_istegi.dart';
import 'package:tup_api/src/generated/model/satis_kalemi.dart';
import 'package:tup_api/src/generated/model/satis_kalemi_sonucu.dart';
import 'package:tup_api/src/generated/model/satis_tamamlama_istegi.dart';
import 'package:tup_api/src/generated/model/satis_tamamlama_istegi_odeme.dart';
import 'package:tup_api/src/generated/model/sayfalama.dart';
import 'package:tup_api/src/generated/model/search_customers_by_phone200_response.dart';
import 'package:tup_api/src/generated/model/sistem_saglik.dart';
import 'package:tup_api/src/generated/model/stok_duzeltme_istegi.dart';
import 'package:tup_api/src/generated/model/stok_hareketi.dart';
import 'package:tup_api/src/generated/model/stok_kalemi.dart';
import 'package:tup_api/src/generated/model/urun.dart';
import 'package:tup_api/src/generated/model/urun_fiyati.dart';

final _regList = RegExp(r'^List<(.*)>$');
final _regSet = RegExp(r'^Set<(.*)>$');
final _regMap = RegExp(r'^Map<String,(.*)>$');

ReturnType deserialize<ReturnType, BaseType>(
  dynamic value,
  String targetType, {
  bool growable = true,
}) {
  switch (targetType) {
    case 'String':
      return '$value' as ReturnType;
    case 'int':
      return (value is int ? value : int.parse('$value')) as ReturnType;
    case 'bool':
      if (value is bool) {
        return value as ReturnType;
      }
      final valueString = '$value'.toLowerCase();
      return (valueString == 'true' || valueString == '1') as ReturnType;
    case 'double':
      return (value is double ? value : double.parse('$value')) as ReturnType;
    case 'CariOdeme':
      return CariOdeme.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'DogrulamaDetayi':
      return DogrulamaDetayi.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'GunSonuSayimi':
      return GunSonuSayimi.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'GunSonuSayimiIstegi':
      return GunSonuSayimiIstegi.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'GunlukKasaOzeti':
      return GunlukKasaOzeti.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'Hata':
      return Hata.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'KasaAcilisIstegi':
      return KasaAcilisIstegi.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'KasaAcilisi':
      return KasaAcilisi.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'ListProducts200Response':
      return ListProducts200Response.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ListStock200Response':
      return ListStock200Response.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'ListStockMovements200Response':
      return ListStockMovements200Response.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'Musteri':
      return Musteri.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'MusteriGuncellemeIstegi':
      return MusteriGuncellemeIstegi.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'MusteriOlusturmaIstegi':
      return MusteriOlusturmaIstegi.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'MusteriPasiflestirmeIstegi':
      return MusteriPasiflestirmeIstegi.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'NakitOdeme':
      return NakitOdeme.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'OturumAcmaIstegi':
      return OturumAcmaIstegi.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'OturumSonlandirmaSonucu':
      return OturumSonlandirmaSonucu.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'OturumYaniti':
      return OturumYaniti.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'ParaTutari':
      return ParaTutari.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'Satis':
      return Satis.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'SatisIptalIstegi':
      return SatisIptalIstegi.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SatisKalemi':
      return SatisKalemi.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'SatisKalemiSonucu':
      return SatisKalemiSonucu.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SatisTamamlamaIstegi':
      return SatisTamamlamaIstegi.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'SatisTamamlamaIstegiOdeme':
      return SatisTamamlamaIstegiOdeme.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'Sayfalama':
      return Sayfalama.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'SearchCustomersByPhone200Response':
      return SearchCustomersByPhone200Response.fromJson(
            value as Map<String, dynamic>,
          )
          as ReturnType;
    case 'SistemSaglik':
      return SistemSaglik.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'StokDuzeltmeIstegi':
      return StokDuzeltmeIstegi.fromJson(value as Map<String, dynamic>)
          as ReturnType;
    case 'StokHareketi':
      return StokHareketi.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'StokKalemi':
      return StokKalemi.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'TupDurumu':
    case 'Urun':
      return Urun.fromJson(value as Map<String, dynamic>) as ReturnType;
    case 'UrunFiyati':
      return UrunFiyati.fromJson(value as Map<String, dynamic>) as ReturnType;
    default:
      RegExpMatch? match;

      if (value is List && (match = _regList.firstMatch(targetType)) != null) {
        targetType = match![1]!; // ignore: parameter_assignments
        return value
                .map<BaseType>(
                  (dynamic v) => deserialize<BaseType, BaseType>(
                    v,
                    targetType,
                    growable: growable,
                  ),
                )
                .toList(growable: growable)
            as ReturnType;
      }
      if (value is Set && (match = _regSet.firstMatch(targetType)) != null) {
        targetType = match![1]!; // ignore: parameter_assignments
        return value
                .map<BaseType>(
                  (dynamic v) => deserialize<BaseType, BaseType>(
                    v,
                    targetType,
                    growable: growable,
                  ),
                )
                .toSet()
            as ReturnType;
      }
      if (value is Map && (match = _regMap.firstMatch(targetType)) != null) {
        targetType = match![1]!.trim(); // ignore: parameter_assignments
        return Map<String, BaseType>.fromIterables(
              value.keys as Iterable<String>,
              value.values.map(
                (dynamic v) => deserialize<BaseType, BaseType>(
                  v,
                  targetType,
                  growable: growable,
                ),
              ),
            )
            as ReturnType;
      }
      break;
  }
  throw Exception('Cannot deserialize');
}
