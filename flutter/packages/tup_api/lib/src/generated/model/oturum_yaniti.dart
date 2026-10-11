//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'oturum_yaniti.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class OturumYaniti {
  /// Returns a new [OturumYaniti] instance.
  OturumYaniti({
    required this.oturumId,

    required this.accessToken,

    required this.tokenType,

    required this.sonaErmeZamaniUtc,
  });

  @JsonKey(name: r'oturumId', required: true, includeIfNull: false)
  final String oturumId;

  @JsonKey(name: r'accessToken', required: true, includeIfNull: false)
  final String accessToken;

  @JsonKey(
    name: r'tokenType',
    required: true,
    includeIfNull: false,
    unknownEnumValue: OturumYanitiTokenTypeEnum.unknownDefaultOpenApi,
  )
  final OturumYanitiTokenTypeEnum tokenType;

  @JsonKey(name: r'sonaErmeZamaniUtc', required: true, includeIfNull: false)
  final DateTime sonaErmeZamaniUtc;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is OturumYaniti &&
          other.oturumId == oturumId &&
          other.accessToken == accessToken &&
          other.tokenType == tokenType &&
          other.sonaErmeZamaniUtc == sonaErmeZamaniUtc;

  @override
  int get hashCode =>
      oturumId.hashCode +
      accessToken.hashCode +
      tokenType.hashCode +
      sonaErmeZamaniUtc.hashCode;

  factory OturumYaniti.fromJson(Map<String, dynamic> json) =>
      _$OturumYanitiFromJson(json);

  Map<String, dynamic> toJson() => _$OturumYanitiToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum OturumYanitiTokenTypeEnum {
  @JsonValue(r'Bearer')
  bearer(r'Bearer'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const OturumYanitiTokenTypeEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
