import 'package:flutter_test/flutter_test.dart';
import 'package:tup_mobile/main.dart';

void main() {
  testWidgets('mobil uygulama acilir', (tester) async {
    await tester.pumpWidget(const TupMobilUygulamasi());

    expect(find.text('TupBayiProje Mobile'), findsOneWidget);
  });
}
