//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'nakit_odeme.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class NakitOdeme {
  /// Returns a new [NakitOdeme] instance.
  NakitOdeme({required this.odemeTuru});

  @JsonKey(
    name: r'odemeTuru',
    required: true,
    includeIfNull: false,
    unknownEnumValue: NakitOdemeOdemeTuruEnum.unknownDefaultOpenApi,
  )
  final NakitOdemeOdemeTuruEnum odemeTuru;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is NakitOdeme && other.odemeTuru == odemeTuru;

  @override
  int get hashCode => odemeTuru.hashCode;

  factory NakitOdeme.fromJson(Map<String, dynamic> json) =>
      _$NakitOdemeFromJson(json);

  Map<String, dynamic> toJson() => _$NakitOdemeToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum NakitOdemeOdemeTuruEnum {
  @JsonValue(r'NAKIT')
  NAKIT(r'NAKIT'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const NakitOdemeOdemeTuruEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
