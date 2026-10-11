//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:tup_api/src/generated/model/sayfalama.dart';
import 'package:tup_api/src/generated/model/stok_hareketi.dart';
import 'package:json_annotation/json_annotation.dart';

part 'list_stock_movements200_response.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ListStockMovements200Response {
  /// Returns a new [ListStockMovements200Response] instance.
  ListStockMovements200Response({required this.data, required this.pagination});

  @JsonKey(name: r'data', required: true, includeIfNull: false)
  final List<StokHareketi> data;

  @JsonKey(name: r'pagination', required: true, includeIfNull: false)
  final Sayfalama pagination;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ListStockMovements200Response &&
          other.data == data &&
          other.pagination == pagination;

  @override
  int get hashCode => data.hashCode + pagination.hashCode;

  factory ListStockMovements200Response.fromJson(Map<String, dynamic> json) =>
      _$ListStockMovements200ResponseFromJson(json);

  Map<String, dynamic> toJson() => _$ListStockMovements200ResponseToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
