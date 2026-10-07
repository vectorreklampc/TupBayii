# Ortak

Bu dizin yalniz birden fazla modulun gercekten paylastigi, business ownership
tasimayan kucuk teknik yapilar icindir.

Domain entity'leri, `DbContext`, repository implementasyonlari veya bir
module ait business kurallari `Ortak` altina tasinamaz. Yeni ortak proje,
somut tekrar ve sahibi belli bir contract ihtiyaci ortaya cikmadan
olusturulmaz.
