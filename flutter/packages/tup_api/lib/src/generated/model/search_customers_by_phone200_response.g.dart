// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'search_customers_by_phone200_response.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SearchCustomersByPhone200Response _$SearchCustomersByPhone200ResponseFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('SearchCustomersByPhone200Response', json, (
  $checkedConvert,
) {
  $checkKeys(json, requiredKeys: const ['data', 'pagination']);
  final val = SearchCustomersByPhone200Response(
    data: $checkedConvert(
      'data',
      (v) => (v as List<dynamic>)
          .map((e) => Musteri.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    pagination: $checkedConvert(
      'pagination',
      (v) => Sayfalama.fromJson(v as Map<String, dynamic>),
    ),
  );
  return val;
});

Map<String, dynamic> _$SearchCustomersByPhone200ResponseToJson(
  SearchCustomersByPhone200Response instance,
) => <String, dynamic>{
  'data': instance.data.map((e) => e.toJson()).toList(),
  'pagination': instance.pagination.toJson(),
};
