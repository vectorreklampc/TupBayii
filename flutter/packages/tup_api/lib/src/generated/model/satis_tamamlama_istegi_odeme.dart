//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:tup_api/src/generated/model/nakit_odeme.dart';
import 'package:tup_api/src/generated/model/cari_odeme.dart';
import 'package:json_annotation/json_annotation.dart';

part 'satis_tamamlama_istegi_odeme.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SatisTamamlamaIstegiOdeme {
  /// Returns a new [SatisTamamlamaIstegiOdeme] instance.
  SatisTamamlamaIstegiOdeme({required this.odemeTuru, required this.musteriId});

  @JsonKey(
    name: r'odemeTuru',
    required: true,
    includeIfNull: false,
    unknownEnumValue:
        SatisTamamlamaIstegiOdemeOdemeTuruEnum.unknownDefaultOpenApi,
  )
  final SatisTamamlamaIstegiOdemeOdemeTuruEnum odemeTuru;

  @JsonKey(name: r'musteriId', required: true, includeIfNull: false)
  final String musteriId;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SatisTamamlamaIstegiOdeme &&
          other.odemeTuru == odemeTuru &&
          other.musteriId == musteriId;

  @override
  int get hashCode => odemeTuru.hashCode + musteriId.hashCode;

  factory SatisTamamlamaIstegiOdeme.fromJson(Map<String, dynamic> json) =>
      _$SatisTamamlamaIstegiOdemeFromJson(json);

  Map<String, dynamic> toJson() => _$SatisTamamlamaIstegiOdemeToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum SatisTamamlamaIstegiOdemeOdemeTuruEnum {
  @JsonValue(r'CARI')
  CARI(r'CARI'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const SatisTamamlamaIstegiOdemeOdemeTuruEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
