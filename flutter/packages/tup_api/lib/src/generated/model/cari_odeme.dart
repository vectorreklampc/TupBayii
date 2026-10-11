//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'cari_odeme.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CariOdeme {
  /// Returns a new [CariOdeme] instance.
  CariOdeme({required this.odemeTuru, required this.musteriId});

  @JsonKey(
    name: r'odemeTuru',
    required: true,
    includeIfNull: false,
    unknownEnumValue: CariOdemeOdemeTuruEnum.unknownDefaultOpenApi,
  )
  final CariOdemeOdemeTuruEnum odemeTuru;

  @JsonKey(name: r'musteriId', required: true, includeIfNull: false)
  final String musteriId;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is CariOdeme &&
          other.odemeTuru == odemeTuru &&
          other.musteriId == musteriId;

  @override
  int get hashCode => odemeTuru.hashCode + musteriId.hashCode;

  factory CariOdeme.fromJson(Map<String, dynamic> json) =>
      _$CariOdemeFromJson(json);

  Map<String, dynamic> toJson() => _$CariOdemeToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum CariOdemeOdemeTuruEnum {
  @JsonValue(r'CARI')
  CARI(r'CARI'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const CariOdemeOdemeTuruEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
