# Workshop — Kreator szablonów talentów

Adres: [Kreator szablonów talentów](http://localhost:8080/#dev-talent-templates). Osobny moduł obok kreatora szablonów kart postaci.

## Obowiązująca koncepcja

- Mamy jeden wspólny szablon HTML dla wszystkich talentów.
- Talent przechowuje treść oraz parametry i flagi. HTML interpretuje te dane i na ich podstawie wyświetla talent.
- Nie tworzymy osobnych typów szablonów ani nie przypisujemy ich do talentów.
- Grupa i podgrupa służą tylko do zarządzania danymi. Nie sterują wyglądem ani flagami.
- Kolejne parametry i flagi będziemy dodawać zgodnie z materiałami i ustaleniami użytkownika.

## Parametry wpływające na wygląd

| Parametr | Działanie w HTML |
| --- | --- |
| `usesPerMission` | Pokazuje odpowiednią liczbę kwadratów użyć: od 0 do 3. Przy 0 nie pokazuje kwadratów. |
| `isDarkGift` | Przy `true` dodaje ikonę Daru Ciemności. Przy `false` jej nie pokazuje. |

Flaga `isDarkGift` jest niezależna od grupy `Dary Ciemności`. Sama przynależność do tej grupy nie włącza ikony.

Ikona Daru Ciemności jest o 35% większa od bazowego rozmiaru ikon. Pasek rezerwuje na nią miejsce również po wyłączeniu flagi, dzięki czemu blok tekstu nie zmienia pozycji.

## Interfejs kreatora

- Kreator pokazuje stałą listę wszystkich elementów wspólnego szablonu i ich podgląd na karcie.
- Nie ma dodawania, usuwania ani duplikowania elementów.
- Element warunkowy pozostaje na liście również wtedy, gdy parametry talentu wyłączają go w podglądzie.
- Można podstawić przykładowe dane lub wybrać talent z wewnętrznej listy.
- Można zmieniać parametry podglądu, aby sprawdzić różne przypadki: 0–3 użycia oraz talent będący Darem Ciemności lub bez tej flagi.
- Zmiany przykładowych danych i flag podglądu nie zapisują się w talentach.
- Ustawienia wspólne obejmują margines, wysokość paska, odstępy, rozmiar tekstu, interlinię i kolory. Ramka ma stałe wymiary.
- Ustawienia zapisujemy przyciskiem „Zapisz szablon” lub Ctrl+S. „Wczytaj ponownie” pobiera zapisany stan.

## Układ karty

Całość zamyka ramka o stałej wielkości. Długość treści nie zmienia wymiarów ramki.

### Pasek statusu

- Zajmuje górną linię karty.
- Z lewej zawsze zaczyna się od heksa.
- Za heksem pojawiają się kolejno ikony aktywnych flag, np. ikona Daru Ciemności przy `isDarkGift: true`.
- Nieaktywne ikony pomijamy; kolejne zajmują miejsce bez pustych luk.
- W tej samej linii, od prawej strony, pokazujemy kwadraty liczby użyć na misję, zgodnie z `usesPerMission`.

### Wspólny blok tekstu

- Znajduje się poniżej paska statusu.
- Łączy kolejno: tytuł (nazwę talentu), opis fabularny i opis działania.
- Jest jednym ciągiem tekstu, który wspólnie zawija się do kolejnych linii. Nie tworzymy trzech osobno pozycjonowanych pól.
- Treść nadal przechowujemy w trzech osobnych polach JSON. Łączymy ją dopiero podczas renderowania HTML.
- Dokładne style tekstu i separatory między częściami pozostają do ustalenia.
- Nazwa jest pogrubiona i zakończona dwukropkiem, opis fabularny zapisany kursywą, a opis działania zwykłym krojem. Części rozdziela spacja.
- Wyrazy dzielimy według polskich wzorców z `hyphen/pl`, wstawiając miękkie łączniki wyłącznie podczas renderowania. Ten sam mechanizm działa w podglądzie i PDF-ie.
- Jednoliterowe słowa `a`, `i`, `o`, `u`, `w`, `z` wiążemy twardą spacją z kolejnym słowem. Wyłączamy przypadkowe łamanie wyrazów w dowolnym miejscu.
- Tekst źródłowy w JSON-ie pozostaje bez zmian.

Miejsce wyświetlania kodu talentu pozostaje do ustalenia.

## Grafiki szablonu

- Materiały użytkownika umieszczamy w `cardTemplates/talenty/Links/`.
- Osobne assety obejmują ramkę, heks, ikony flag i kwadrat użycia.
- Preferujemy SVG; PNG powinien mieć przezroczyste tło.
- Dostarczone pliki:

| Plik | Zastosowanie |
| --- | --- |
| `talent_ramka.svg` | Ramka całej karty. |
| `hex.svg` | Stały pierwszy element paska statusu. |
| `czacha-dary-ciemnoscie.svg` | Ikona wyświetlana przy `isDarkGift: true`. |
| `kwadrat.svg` | Powtarzany kwadrat użycia, zgodnie z `usesPerMission`. |

- Kreator i PDF pobierają assety z tego katalogu.
- Dla heksa i kwadratu serwer dopasowuje viewBox do samej grafiki, pomijając puste marginesy eksportu. Źródłowe SVG pozostają bez zmian.

## Podgląd i PDF

- „Pobierz grafikę na Facebooka”, obok przycisku PDF-a, generuje PNG `1200 × 1200 px` z aktualnymi danymi podglądu.
- Grafika reklamowa zawiera ilustrację z okładki, oficjalne logo Klanarchii, logo What The Frog, hasło „TEN TALENT JEST TYLKO MÓJ!” oraz aktualną kartę talentu. Nie pokazuje kodu talentu.
- Ilustracja: `app/src/assets/social/klanarchia-cover-frontandback.png`, skopiowana z pliku użytkownika `Klanarchiacover_illustration_frontandback.png`. Używamy oryginalnej ilustracji, kadrowania i łagodnych przejść tła. Bez generowania nowych ilustracji.
- Przekaz reklamy: odbiorca chwali się własnym, unikalnym talentem do Klanarchii i zachęca innych do wsparcia zbiórki. Wezwanie: „Wesprzyj zbiórkę i zdobądź swój TALENT”. Słowo „TALENT” jest wyróżnione. Wezwanie i logo Gamefound znajdują się wyżej po prawej stronie, obok górnej części karty. Nie dodajemy napisu „Z kroniki mojej postaci”.
- Kompozycja reklamowa: `app/scripts/talent-social-poster.cjs`. Ilustracja okładkowa wypełnia kadr; tekst ma charakter składu księgi RPG, a karta talentu jest wkomponowana jako przekrzywiony, postrzępiony pergamin. Bez ramek strony, sekcji i przycisków w samej grafice.
- Grafika z podglądu mailingowego pokazuje nad pergaminem „Talent nr: …”, z numerem kolejnym odbiorcy (`sequenceNumber`). Zwykły eksport z kreatora bez odbiorcy nie dodaje numeru.
- Powiększono ikony w lewym górnym rogu karty: heks ma 1,25 × `statusHeight`, ikona Daru Ciemności 1,7 × `statusHeight`. Pasek statusu ma wysokość 1,7 × `statusHeight`, aby ikony nie nachodziły na opis. Kwadraty użyć po prawej zachowują swój rozmiar. Dotyczy wspólnego podglądu i eksportu.
- Tekst samej karty korzysta z dołączonej Linux Libertine (regular, semibold, bold, italic, bold italic), identycznie w kreatorze, podglądzie biblioteki, PDF i karcie w grafice reklamowej. Stan ma kapitaliki i semibold, aspekt tło `#b1b7c6`, cecha pogrubienie z kursywą. Pozostała typografia plakatu pozostaje bez zmian. Szczegóły plików i licencji: [[Workshop/przeglad-i-import-talentow]].
- Karta talentu pozostaje renderowana ze wspólnego szablonu. Zabarwienie pergaminu dotyczy tylko grafiki reklamowej; PDF zachowuje swój wygląd.
- Logo Gamefound pochodzi z [oficjalnego media kitu](https://help.gamefound.com/article/129-media-kit-for-promotion), pakietu Social Media Stickers. Plik: `app/src/assets/social/gamefound-back-now-official.png`. W kompozycji pokazujemy fragment zawierający logo, z zachowaniem oryginalnych kolorów i proporcji.
- Krój nagłówka i wezwania: Cormorant Garamond z oficjalnego repozytorium Google Fonts, osadzony lokalnie. Font i licencja: `app/src/assets/fonts/CormorantGaramond.ttf` i `CormorantGaramond-OFL.txt`.
- PNG pobieramy na komputer do ręcznego opublikowania. Przycisk nie publikuje na Facebooku i nie wymaga publicznej strony talentu.
- Grafika nie zmienia danych talentu ani jego kodu. Jeśli tekst nie mieści się w ramce, generowanie jest blokowane jak przy PDF-ie.

- Podgląd i PDF korzystają z jednego wspólnego sposobu renderowania HTML.
- Na razie nie wyświetlamy kodu: jego miejsce pozostaje do ustalenia.
- Podgląd i próbny PDF nie nadają kodów talentom.
- Sprawdzamy krótkie i długie opisy oraz różne zestawy parametrów.
- Wysyłka e-maili należy do [[Workshop/talenty_ekskluzyne]].

## Pliki i stan implementacji

- Nowa koncepcja jest wdrożona: jeden renderer HTML, stała lista elementów, flaga `isDarkGift`, brak typów szablonów.
- Ustawienia wspólnego szablonu: `cardTemplates/talenty/szablon.json`, format `schemaVersion: 2`.
- Stałe wymiary ramki odpowiadają dostarczonemu SVG: `185,67 × 101,76 pt`, czyli około `65,5 × 35,9 mm`.
- Minimum tekstu wynosi 9 pt w kreatorze, walidacji API i dopasowaniu tekstu. Domyślnie `fontSize: 9`, `minFontSize: 9`, interlinia 1,12. Większy tekst może być dopasowany najwyżej do 9 pt; dalsze przepełnienie blokuje eksport.
- Margines poziomy pozostaje 7 pt. Nowy osobny `verticalPadding` wynosi 3,5 pt (wcześniej góra/dół miały 7 pt), a `textGap` 1 pt zamiast 4 pt. Przy obecnych ikonach mieści się siedem linii po 9 pt. Szablon zapisano po wykonaniu kopii `szablon.json.before-minimum-9pt-<czas>.bak`. Starsze szablony bez `verticalPadding` odczytujemy z wartością 3,5 pt.
- Kontrola obecnych 19 talentów z Linux Libertine: przy tym układzie i minimum 9 pt przepełnienie pozostaje dla „Prymatu potępieńca”. Treści nie skracano; eksport tego talentu zgłosi błąd do czasu poprawy składu lub tekstu.
- Starszy katalog `cardTemplates/szablony-talentow` nie jest używany. Jego pliki zachowujemy bez zmian.
- JSON talentów przechowuje `isDarkGift`. Nie używamy `templateTypeId`.
- Przy zapisie ustawień zachowujemy `.bak`, używamy pliku tymczasowego i sprawdzamy konflikt wersji.
- Tekst jest automatycznie pomniejszany do ustawionego minimum. Jeśli nadal nie mieści się w ramce, eksport jest blokowany z komunikatem.
- Dotychczasowym 19 talentom z PDF-a ustawiono `isDarkGift: true`, na podstawie ikon w źródle, a nie nazwy grupy. Istniejące jawnie ustawione flagi są zachowywane.
- Test: `docker compose exec app node scripts/verify-talent-templates.cjs`. Korzysta z osobnych danych.

Powiązane: [[Workshop/przeglad-i-import-talentow]], [[Workshop/talenty_ekskluzyne]].

- Logo Klanarchii jest w prawym górnym rogu, a logo What The Frog w prawym dolnym, nad podpisem. Hasło po lewej zaczyna się na wysokości 90 px, a opis na 396 px. Karta talentu jest lekko przechylona o −3°, bliżej poziomu.
