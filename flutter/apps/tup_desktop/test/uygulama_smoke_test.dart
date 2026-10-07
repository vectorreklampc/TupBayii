import 'package:flutter_test/flutter_test.dart';
import 'package:tup_desktop/main.dart';

void main() {
  testWidgets('masaustu uygulamasi acilir', (tester) async {
    await tester.pumpWidget(const TupMasaustuUygulamasi());

    expect(find.text('TupBayiProje Desktop'), findsOneWidget);
  });
}
