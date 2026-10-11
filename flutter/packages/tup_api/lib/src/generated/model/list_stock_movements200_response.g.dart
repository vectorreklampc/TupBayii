// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'list_stock_movements200_response.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ListStockMovements200Response _$ListStockMovements200ResponseFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ListStockMovements200Response', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['data', 'pagination']);
  final val = ListStockMovements200Response(
    data: $checkedConvert(
      'data',
      (v) => (v as List<dynamic>)
          .map((e) => StokHareketi.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    pagination: $checkedConvert(
      'pagination',
      (v) => Sayfalama.fromJson(v as Map<String, dynamic>),
    ),
  );
  return val;
});

Map<String, dynamic> _$ListStockMovements200ResponseToJson(
  ListStockMovements200Response instance,
) => <String, dynamic>{
  'data': instance.data.map((e) => e.toJson()).toList(),
  'pagination': instance.pagination.toJson(),
};
