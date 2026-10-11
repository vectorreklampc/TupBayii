// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sayfalama.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Sayfalama _$SayfalamaFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Sayfalama', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['page', 'pageSize', 'totalItems', 'totalPages'],
      );
      final val = Sayfalama(
        page: $checkedConvert('page', (v) => (v as num).toInt()),
        pageSize: $checkedConvert('pageSize', (v) => (v as num).toInt()),
        totalItems: $checkedConvert('totalItems', (v) => (v as num).toInt()),
        totalPages: $checkedConvert('totalPages', (v) => (v as num).toInt()),
      );
      return val;
    });

Map<String, dynamic> _$SayfalamaToJson(Sayfalama instance) => <String, dynamic>{
  'page': instance.page,
  'pageSize': instance.pageSize,
  'totalItems': instance.totalItems,
  'totalPages': instance.totalPages,
};
