//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:tup_api/src/generated/model/sayfalama.dart';
import 'package:tup_api/src/generated/model/urun.dart';
import 'package:json_annotation/json_annotation.dart';

part 'list_products200_response.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ListProducts200Response {
  /// Returns a new [ListProducts200Response] instance.
  ListProducts200Response({required this.data, required this.pagination});

  @JsonKey(name: r'data', required: true, includeIfNull: false)
  final List<Urun> data;

  @JsonKey(name: r'pagination', required: true, includeIfNull: false)
  final Sayfalama pagination;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ListProducts200Response &&
          other.data == data &&
          other.pagination == pagination;

  @override
  int get hashCode => data.hashCode + pagination.hashCode;

  factory ListProducts200Response.fromJson(Map<String, dynamic> json) =>
      _$ListProducts200ResponseFromJson(json);

  Map<String, dynamic> toJson() => _$ListProducts200ResponseToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
