import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:test/test.dart';
import 'package:tup_api/tup_api.dart';

void main() {
  test(
    'generated client kanonik mock saglik operasyonunu typed cagirir',
    () async {
      final geciciSunucu = await ServerSocket.bind(
        InternetAddress.loopbackIPv4,
        0,
      );
      final port = geciciSunucu.port;
      await geciciSunucu.close();

      final ayirac = Platform.pathSeparator;
      final depoKoku = Directory.current.parent.path;
      final mockScript =
          '$depoKoku${ayirac}contracts${ayirac}scripts${ayirac}mock-server.mjs';
      final mockSuresi = await Process.start(
        'node',
        [mockScript],
        workingDirectory: depoKoku,
        environment: {
          ...Platform.environment,
          'MOCK_HOST': '127.0.0.1',
          'MOCK_PORT': '$port',
        },
        runInShell: Platform.isWindows,
      );

      final hataCiktisi = StringBuffer();
      final hataAboneligi = mockSuresi.stderr
          .transform(utf8.decoder)
          .listen(hataCiktisi.write);

      try {
        await mockSuresi.stdout
            .transform(utf8.decoder)
            .transform(const LineSplitter())
            .firstWhere((satir) => satir.contains('adresinde hazir'))
            .timeout(const Duration(seconds: 10));

        final yanit = await TupApi(
          basePathOverride: 'http://127.0.0.1:$port',
        ).getSystemApi().getSystemHealth();
        final saglik = yanit.data;

        expect(yanit.statusCode, 200);
        expect(saglik, isNotNull);
        expect(saglik!.status, SistemSaglikStatusEnum.ok);
        expect(saglik.service, 'tup-bayi-api');
        expect(saglik.apiVersion, 'v1');
        expect(saglik.timestampUtc, DateTime.utc(2026, 10, 7));
        expect(yanit.headers.value('TraceId'), saglik.traceId);
      } finally {
        mockSuresi.kill();
        await mockSuresi.exitCode;
        await hataAboneligi.cancel();
        if (hataCiktisi.isNotEmpty) {
          stderr.write(hataCiktisi);
        }
      }
    },
  );
}
