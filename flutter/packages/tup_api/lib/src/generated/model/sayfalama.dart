//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'sayfalama.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Sayfalama {
  /// Returns a new [Sayfalama] instance.
  Sayfalama({
    required this.page,

    required this.pageSize,

    required this.totalItems,

    required this.totalPages,
  });

  // minimum: 1
  @JsonKey(name: r'page', required: true, includeIfNull: false)
  final int page;

  // minimum: 1
  @JsonKey(name: r'pageSize', required: true, includeIfNull: false)
  final int pageSize;

  // minimum: 0
  @JsonKey(name: r'totalItems', required: true, includeIfNull: false)
  final int totalItems;

  // minimum: 0
  @JsonKey(name: r'totalPages', required: true, includeIfNull: false)
  final int totalPages;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Sayfalama &&
          other.page == page &&
          other.pageSize == pageSize &&
          other.totalItems == totalItems &&
          other.totalPages == totalPages;

  @override
  int get hashCode =>
      page.hashCode +
      pageSize.hashCode +
      totalItems.hashCode +
      totalPages.hashCode;

  factory Sayfalama.fromJson(Map<String, dynamic> json) =>
      _$SayfalamaFromJson(json);

  Map<String, dynamic> toJson() => _$SayfalamaToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
