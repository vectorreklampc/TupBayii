import 'package:flutter/material.dart';

void main() {
  runApp(const TupMobilUygulamasi());
}

class TupMobilUygulamasi extends StatelessWidget {
  const TupMobilUygulamasi({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      home: Scaffold(body: Center(child: Text('TupBayiProje Mobile'))),
    );
  }
}
