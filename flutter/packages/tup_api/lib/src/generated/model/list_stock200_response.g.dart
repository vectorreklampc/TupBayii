// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'list_stock200_response.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ListStock200Response _$ListStock200ResponseFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ListStock200Response', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['data', 'pagination']);
  final val = ListStock200Response(
    data: $checkedConvert(
      'data',
      (v) => (v as List<dynamic>)
          .map((e) => StokKalemi.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    pagination: $checkedConvert(
      'pagination',
      (v) => Sayfalama.fromJson(v as Map<String, dynamic>),
    ),
  );
  return val;
});

Map<String, dynamic> _$ListStock200ResponseToJson(
  ListStock200Response instance,
) => <String, dynamic>{
  'data': instance.data.map((e) => e.toJson()).toList(),
  'pagination': instance.pagination.toJson(),
};
