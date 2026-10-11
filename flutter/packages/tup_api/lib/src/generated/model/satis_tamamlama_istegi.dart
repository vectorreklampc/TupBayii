//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:tup_api/src/generated/model/satis_kalemi.dart';
import 'package:tup_api/src/generated/model/satis_tamamlama_istegi_odeme.dart';
import 'package:json_annotation/json_annotation.dart';

part 'satis_tamamlama_istegi.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SatisTamamlamaIstegi {
  /// Returns a new [SatisTamamlamaIstegi] instance.
  SatisTamamlamaIstegi({required this.kalemler, required this.odeme});

  @JsonKey(name: r'kalemler', required: true, includeIfNull: false)
  final List<SatisKalemi> kalemler;

  @JsonKey(name: r'odeme', required: true, includeIfNull: false)
  final SatisTamamlamaIstegiOdeme odeme;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SatisTamamlamaIstegi &&
          other.kalemler == kalemler &&
          other.odeme == odeme;

  @override
  int get hashCode => kalemler.hashCode + odeme.hashCode;

  factory SatisTamamlamaIstegi.fromJson(Map<String, dynamic> json) =>
      _$SatisTamamlamaIstegiFromJson(json);

  Map<String, dynamic> toJson() => _$SatisTamamlamaIstegiToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
