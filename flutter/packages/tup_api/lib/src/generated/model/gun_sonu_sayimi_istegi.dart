//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:tup_api/src/generated/model/para_tutari.dart';
import 'package:json_annotation/json_annotation.dart';

part 'gun_sonu_sayimi_istegi.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class GunSonuSayimiIstegi {
  /// Returns a new [GunSonuSayimiIstegi] instance.
  GunSonuSayimiIstegi({required this.sayilanNakitTutari});

  @JsonKey(name: r'sayilanNakitTutari', required: true, includeIfNull: false)
  final ParaTutari sayilanNakitTutari;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is GunSonuSayimiIstegi &&
          other.sayilanNakitTutari == sayilanNakitTutari;

  @override
  int get hashCode => sayilanNakitTutari.hashCode;

  factory GunSonuSayimiIstegi.fromJson(Map<String, dynamic> json) =>
      _$GunSonuSayimiIstegiFromJson(json);

  Map<String, dynamic> toJson() => _$GunSonuSayimiIstegiToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
