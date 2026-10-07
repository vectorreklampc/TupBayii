import 'package:flutter/material.dart';

void main() {
  runApp(const TupMasaustuUygulamasi());
}

class TupMasaustuUygulamasi extends StatelessWidget {
  const TupMasaustuUygulamasi({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      home: Scaffold(body: Center(child: Text('TupBayiProje Desktop'))),
    );
  }
}
