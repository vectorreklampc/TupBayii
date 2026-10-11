//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'oturum_sonlandirma_sonucu.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class OturumSonlandirmaSonucu {
  /// Returns a new [OturumSonlandirmaSonucu] instance.
  OturumSonlandirmaSonucu({
    required this.oturumId,

    required this.sonlandirmaZamaniUtc,
  });

  @JsonKey(name: r'oturumId', required: true, includeIfNull: false)
  final String oturumId;

  @JsonKey(name: r'sonlandirmaZamaniUtc', required: true, includeIfNull: false)
  final DateTime sonlandirmaZamaniUtc;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is OturumSonlandirmaSonucu &&
          other.oturumId == oturumId &&
          other.sonlandirmaZamaniUtc == sonlandirmaZamaniUtc;

  @override
  int get hashCode => oturumId.hashCode + sonlandirmaZamaniUtc.hashCode;

  factory OturumSonlandirmaSonucu.fromJson(Map<String, dynamic> json) =>
      _$OturumSonlandirmaSonucuFromJson(json);

  Map<String, dynamic> toJson() => _$OturumSonlandirmaSonucuToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
