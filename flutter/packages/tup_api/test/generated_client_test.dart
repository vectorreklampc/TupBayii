import 'package:test/test.dart';
import 'package:tup_api/tup_api.dart';

void main() {
  test('client mock server adresini disaridan alir', () {
    final client = TupApi(basePathOverride: 'http://localhost:4010');

    expect(client.dio.options.baseUrl, 'http://localhost:4010');
  });

  test('OpenAPI hata modelini typed olarak serilestirir', () {
    final hata = Hata.fromJson({
      'code': 'DOGRULAMA_HATASI',
      'message': 'Girdi gecersiz.',
      'traceId': 'trace-1',
      'details': [
        {'field': 'tutar', 'code': 'POZITIF_OLMALI'},
      ],
    });

    expect(hata.code, 'DOGRULAMA_HATASI');
    expect(hata.details?.single.field, 'tutar');
    expect(hata.toJson()['traceId'], 'trace-1');
  });
}
