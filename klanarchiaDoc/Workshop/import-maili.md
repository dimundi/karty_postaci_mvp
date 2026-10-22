# Import maili

## Stan

Import wdrożony w Workshop: „Przeglądaj” → „Pokaż podgląd importu” → „Zatwierdź import”. Sam wybór pliku nie przesyła go do serwera. Podgląd przesyła CSV do lokalnego API bez zmiany listy; zatwierdzenie zapisuje nowe wpisy. Rzeczywistego pliku nie zaimportowano podczas wdrożenia.

## Sprawdzony plik

- Źródło: `klanarchiaDoc/Workshop/emails/Aetherworks.csv`.
- 122 rekordy danych, bez nagłówka.
- Kodowanie UTF-16 LE z BOM (`FF FE`). Nie odczytywać jako UTF-8.
- Separator: przecinek. Pola mogą być otoczone cudzysłowami i zawierać przecinki. Wymagany parser CSV; dzielenie wiersza po przecinku jest błędne.
- 11 kolumn: `order,name,company,address1,address2,suburb,state,postcode,country,email,phone`.
- Importujemy `order` jako tekstowe `orderId` oraz `email`. Pozostałe kolumny nie są potrzebne.
- Brak pustych zamówień i adresów. Wszystkie 122 adresy przechodzą obecną walidację serwera.
- Brak powtórzeń zamówień, adresów i par zamówienie–adres.
- Brak kolizji adresów z dwoma istniejącymi wpisami.

## Wpisy testowe

- Dwa istniejące wpisy w `privateData/mailing-list.json` otrzymały `sequenceNumber: 900` i `901`, według dotychczasowej kolejności w pliku, oraz `orderId: TEST`.
- `TEST` może się powtarzać. Ten wyjątek nie pozwala powtarzać adresów e-mail.
- Wpisy testowe nie wyznaczają początku ani kontynuacji numeracji importu.
- Kopia stanu sprzed zmiany: `privateData/mailing-list.json.before-test-numbering.bak`.
- Pozostałe dane istniejących wpisów zachowano. Lista nadal ma dwa wpisy.

## Działanie

1. Użytkownik wybiera CSV przyciskiem „Przeglądaj”. Sam wybór nie zapisuje danych.
2. Serwer rozpoznaje BOM i dekoduje plik. Wzorcowy plik wymaga UTF-16 LE; dla UTF-8 należy również obsłużyć BOM. Nieznane kodowanie zgłaszamy jako błąd.
3. Parser CSV odczytuje nagłówek i rekordy z obsługą cudzysłowów. Sprawdzamy kolumny `order` i `email` oraz poprawność struktury rekordów.
4. Usuwamy zewnętrzne spacje z `order`; zachowujemy tekst i wielkość liter. E-mail normalizujemy obecną funkcją serwera. Puste lub błędne wartości zgłaszamy przy rekordzie.
5. Sprawdzamy pary `orderId` + `email`, osobno adresy i zamówienia, zarówno w pliku, jak i na zapisanej liście. Istniejącą identyczną parę pomijamy. Konflikt adresu z innym zamówieniem lub zamówienia z innym adresem zgłaszamy jako błąd. `TEST` jest wyjątkiem od unikalności zamówienia.
6. Przygotowujemy podgląd: liczba nowych wpisów, pominiętych i błędnych; tabela z numerem rekordu źródłowego, `orderId`, e-mailem, proponowanym `sequenceNumber` oraz powodem pominięcia lub błędu. Numer rekordu danych zaczyna się od 1, bez nagłówka.
7. Nowe numery nadajemy według kolejności pliku, od 1 lub po największym numerze nietestowym. Pominięte wpisy nie zużywają numerów. Wszystkie zapisane numery, również testowe, pozostają zajęte: przy dojściu do 900 i 901 trzeba je ominąć. Nie zmieniamy wcześniej nadanych numerów.
8. Zapis następuje dopiero po kliknięciu „Zatwierdź import”. Przed zapisem ponownie sprawdzamy aktualną listę; zmiana od czasu podglądu wymaga odświeżenia podglądu.
9. Zapisujemy listę atomowo, z kopią zapasową. Nowy wpis otrzymuje UUID, `orderId`, `sequenceNumber`, `email`, datę dodania, `deliveryStatus: not_sent` i `talentId: null`. Import nie uruchamia wysyłki i nie przydziela talentów.
10. Pokazujemy wynik. Ponowny import tego samego pliku nie dodaje wpisów ani nie zmienia ich numerów.

Przy obecnej liście podgląd tego pliku powinien pokazać 122 nowe wpisy z numerami 1–122. Wpisy testowe zachowają 900 i 901.

## Obsługa błędów

- Każdy błąd blokuje zatwierdzenie całego importu. Podgląd pozostaje dostępny do sprawdzenia.
- Identyczne pary powtórzone w jednym pliku oznaczamy jako powtórzenia; dodajemy wyłącznie pierwsze wystąpienie.
- Serwer przechowuje najwyżej 10 podglądów w pamięci przez 30 minut. Po restarcie serwera lub wygaśnięciu trzeba ponownie przygotować podgląd.
- Limit pliku: 5 MB i 20 000 rekordów. Obsługiwane kodowania: UTF-8 (z BOM lub bez) oraz UTF-16 LE/BE z BOM.

## API

- `POST /api/mailing-list/import-preview`: surowe bajty CSV; zwraca podgląd i `draftId`.
- `POST /api/mailing-list/import`: JSON z `draftId`. Zapis wyłącznie na podstawie podglądu serwera, po sprawdzeniu rewizji listy.
- `POST /api/mailing-list/edit`: `id`, `originalEmail`, `email`. Zmienia wyłącznie adres istniejącego wpisu; blokuje duplikaty i edycję dla statusów `sending` / `sent`.
- Starsze wpisy bez zamówienia lub numeru pozostają czytelne. Kolizja importu z ich adresem wymaga wyjaśnienia przed zapisem.

## Sprawdzenie

- Pierwszy import zaczyna się od 1 mimo wpisów testowych 900 i 901.
- Powtórny import nie zmienia danych. Nowe rekordy kontynuują numerację.
- Konflikty w pliku i z bazą blokują zapis; powtarzalne `TEST` jest dozwolone.
- Parser poprawnie czyta UTF-16 LE, przecinki w cudzysłowach i nagłówek.
- Zmiana listy po podglądzie nie pozwala zapisać nieaktualnego wyniku.
- Błąd odczytu lub zapisu nie niszczy dotychczasowej listy.

Test na danych tymczasowych: `docker compose exec app node scripts/verify-mailing-import.cjs`. Sprawdza parser, numerację, konflikty, wyjątek TEST, zmianę listy po podglądzie oraz wybór pliku, podgląd, zatwierdzenie i edycję przez UI. Nie importuje do rzeczywistej listy i nie wysyła maili.
