//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'oturum_acma_istegi.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class OturumAcmaIstegi {
  /// Returns a new [OturumAcmaIstegi] instance.
  OturumAcmaIstegi({required this.kullaniciAdi, required this.parola});

  @JsonKey(name: r'kullaniciAdi', required: true, includeIfNull: false)
  final String kullaniciAdi;

  @JsonKey(name: r'parola', required: true, includeIfNull: false)
  final String parola;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is OturumAcmaIstegi &&
          other.kullaniciAdi == kullaniciAdi &&
          other.parola == parola;

  @override
  int get hashCode => kullaniciAdi.hashCode + parola.hashCode;

  factory OturumAcmaIstegi.fromJson(Map<String, dynamic> json) =>
      _$OturumAcmaIstegiFromJson(json);

  Map<String, dynamic> toJson() => _$OturumAcmaIstegiToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
