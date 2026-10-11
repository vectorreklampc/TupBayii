//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:tup_api/src/generated/model/sayfalama.dart';
import 'package:tup_api/src/generated/model/musteri.dart';
import 'package:json_annotation/json_annotation.dart';

part 'search_customers_by_phone200_response.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SearchCustomersByPhone200Response {
  /// Returns a new [SearchCustomersByPhone200Response] instance.
  SearchCustomersByPhone200Response({
    required this.data,

    required this.pagination,
  });

  @JsonKey(name: r'data', required: true, includeIfNull: false)
  final List<Musteri> data;

  @JsonKey(name: r'pagination', required: true, includeIfNull: false)
  final Sayfalama pagination;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SearchCustomersByPhone200Response &&
          other.data == data &&
          other.pagination == pagination;

  @override
  int get hashCode => data.hashCode + pagination.hashCode;

  factory SearchCustomersByPhone200Response.fromJson(
    Map<String, dynamic> json,
  ) => _$SearchCustomersByPhone200ResponseFromJson(json);

  Map<String, dynamic> toJson() =>
      _$SearchCustomersByPhone200ResponseToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
