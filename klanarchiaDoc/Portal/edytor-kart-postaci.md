# Portal — Edytor kart postaci

Moduł Portalu dostępnego pod adresem [#user](http://localhost:8080/#user). Portal obejmie również inne funkcje.

Poniższy opis zawiera obecne działanie i zaplanowany zakres. Sam zapis funkcji nie oznacza jej wdrożenia.

## Zakres

- Tworzenie i uzupełnianie karty postaci do gry RPG **Klanarchia**.
- Eksport karty do PDF.
- Użytkownik wybiera rodzaj PDF-u przy eksporcie.
- Zwykły PDF ma utrwalone dane i zaznaczenia. Interaktywny PDF pozwala zmieniać udostępnione pola formularza po eksporcie.
- Wybór rodzaju eksportu jest do wdrożenia. Obecny eksport tworzy interaktywny PDF.
- Szablony kart będą dostarczone jako gotowe tła w PDF.
- Zostaną dostarczone przykładowe szablony kart klanu i archetypu oraz lista nanoszonych pól.
- Aplikacja umieści tekst i zaznaczenia w ustalonych miejscach szablonu.
- Użytkownik wybierze jedną z 4 kart klanu.
- Użytkownik wybierze jedną z 9 kart archetypu.
- Liczba kart klanów i archetypów może się później zmienić.
- Po wypełnieniu danych użytkownik zobaczy podgląd gotowych kart.
- Gotowe karty będzie można wydrukować.
- Karta jednej postaci będzie eksportowana jako dwustronicowy PDF: karta klanu i karta archetypu.
- Użytkownik będzie mógł przygotować kilka postaci naraz.
- Eksport wielu postaci utworzy jeden PDF zawierający wszystkie ich karty.
- Domyślna kolejność stron: klan i archetyp pierwszej postaci, potem klan i archetyp kolejnej postaci.
- Kolejność stron powinna być łatwa do zmiany.
- Dane przygotowanych postaci będzie można wyeksportować do JSON.
- Dane z JSON będzie można ponownie wczytać i odtworzyć karty.
- Dostępne będą również predefiniowane karty postaci.
- Po wybraniu predefiniowanej postaci użytkownik będzie mógł zmienić jej dane przed eksportem.
- Szablony klanów znajdują się w `pdfTemplates/klany` — 4 pliki PDF.
- Szablony archetypów znajdują się w `pdfTemplates/archetypy` — 9 plików PDF.

## Karta klanu

- Każda karta ma przypisaną stałą nazwę klanu.
- Nazwa klanu nie jest edytowalna i nie jest nanoszona na PDF.
- Nazwa klanu służy do identyfikacji i wyboru szablonu.
- Każdy aspekt frakcji ma nazwę i własną pozycję zaznaczenia `[x]`.
- Każde pole żaru ma własną pozycję zaznaczenia `[x]`.
- Pola żaru są numerowane automatycznie od 1 do 3.
- Na jednej karcie mogą być maksymalnie 3 pola żaru.
- Każdy talent ma nazwę i własną pozycję zaznaczenia `[x]`.
- Zaznaczenie `[x]` mrocznego instynktu.
- Pola mrocznego instynktu są numerowane automatycznie od 1 do 3.
- Na jednej karcie mogą być maksymalnie 3 pola mrocznego instynktu.
- Dary ciemności mają osobne wielowierszowe pole tekstowe.

## Edytor użytkownika

- Domyślnym widokiem aplikacji jest strona startowa.
- Strona startowa zawiera wejścia: karta od zera, postać predefiniowana i wczytanie JSON-u.
- Niezaimplementowane wejścia są widoczne jako nieaktywne.
- W developmentcie strona startowa ma przycisk przejścia do edytora technicznego.
- Przycisk przejścia do WORKSHOP nie trafia do produkcyjnego buildu.
- Użytkownik wybiera skonfigurowaną kartę klanu.
- Wejście „Wypełnij kartę od zera” najpierw otwiera osobny ekran wyboru klanu.
- Klan nie jest wybierany automatycznie, nawet jeśli dostępna jest tylko jedna skonfigurowana karta.
- Karty bez konfiguracji JSON są widoczne, ale nieaktywne.
- Pod kafelkami klanów znajduje się 9 kafelków kart archetypów.
- Przed przejściem dalej użytkownik wybiera jedną kartę klanu i jedną kartę archetypu.
- Ekran wyboru ma tytuł „Skonfiguruj pierwszą postać”.
- Sekcje wyboru mają tytuły „Wybierz kartę klanu” i „Wybierz kartę archetypu”.
- Do czasu przygotowania konfiguracji archetypów ich kafelki pokazują nazwy robocze.
- Formularz jest generowany na podstawie JSON-u wybranego szablonu.
- Aspekty frakcji i talenty są dostępne jako checkboxy.
- Żar i mroczny instynkt są wybierane jako wartość od 0 do 3.
- Dary ciemności są wpisywane w polu tekstowym.
- Zmiany są widoczne od razu na podglądzie PDF.
- Pola można zaznaczać również bezpośrednio na podglądzie PDF.
- Widok użytkownika pozwala powiększać i pomniejszać PDF.
- Produkcyjny build zawiera widok użytkownika, PDF-y i zapisane konfiguracje JSON.
- Development pobiera szablony z `/templates`.
- Produkcja pobiera szablony z `https://whatthefrog.pl/download/Klanarchia/kpostaci/templates`.
- Adres bazowy szablonów jest ustawiany podczas kompilacji przez Webpack.
- Produkcyjne logo klanów są pobierane z `https://whatthefrog.pl/download/Klanarchia/kpostaci/assets/clans`.
- Worker PDF.js jest kompilowany jako `assets/pdf.worker.[hash].js`, ponieważ serwer nie obsługuje poprawnego MIME dla `.mjs`.

## Przełączanie kart podczas edycji

- W formularzu klanu jest lista pozwalająca zmienić wcześniej wybrany klan.
- Wyraźny przycisk `Następny krok: Edytuj archetyp` przełącza na formularz wybranego archetypu.
- W formularzu archetypu użytkownik wpisuje imię lub przydomek.
- Nazwa klanu jest wstępnie pobierana z wybranej karty klanu, ale użytkownik może ją edytować.
- Przycisk `Wstecz` przeglądarki wraca kolejno z archetypu do klanu, a potem do wyboru kart.
- Formularz archetypu ma w prawym górnym rogu przyciski `Cofnij do edycji klanu` i `Eksportuj do PDF`.
- Eksport tworzy jeden PDF z dwiema stronami: kartą klanu i kartą archetypu.
- Dane oraz zaznaczenia są nanoszone na oryginalne szablony PDF.
- Wszystkie checkboxy talentów i aspektów frakcji są interaktywnymi polami formularza PDF (AcroForm).
- Pola „Imię lub przydomek” i „Nazwa klanu” na karcie archetypu są edytowalnymi polami tekstowymi PDF. Eksport wypełnia je danymi z edytora.
- Pola tekstowe zachowują pozycje, rozmiary i wielkość czcionki z konfiguracji. Tekst można zmienić i zapisać w PDF.
- Eksport osadza pełny font Noto Sans z `app/src/assets/fonts` przez `@pdf-lib/fontkit`, aby obsłużyć polskie znaki również podczas późniejszej edycji. Licencja fontu jest w `OFL.txt`.
- Ich początkowe zaznaczenia pochodzą z edytora. Po eksporcie można je zaznaczać i odznaczać oraz zapisać zmieniony PDF.
- Pola talentów i aspektów frakcji zachowują pozycję, rozmiar i styl znaku `x` lub `v` z konfiguracji. Zaznaczenie nie jest nanoszone na stałe na tło.
- Test eksportu: `docker compose run --rm build node scripts/verify-pdf-export.cjs`. Sprawdza liczbę i pozycje pól, stan początkowy, polskie znaki oraz zapis po zmianie tekstów i zaznaczeń.
- Widoki użytkownika działają od szerokości 320 px.
- Na telefonie nagłówek i przyciski układają się pionowo, a podgląd PDF startuje w pomniejszeniu dopasowanym do ekranu.
- Ekran wyboru kart ma własne przewijanie pionowe na telefonie.
- Ekrany edycji klanu i archetypu mają jedno przewijanie pionowe całej strony.
- Na telefonie formularz i podgląd PDF nie tworzą osobnych pionowych obszarów przewijania.
- Na mobilnym ekranie edycji klanu przycisk następnego kroku jest powtórzony na samym dole strony.
- Sterowanie powiększeniem znajduje się bezpośrednio nad podglądem PDF.
- Sterowanie powiększeniem jest wyśrodkowane nad podglądem PDF.
- Sekcje aspektów frakcji i talentów można zwijać.
- Pole Żaru ma etykietę `Początkowa wartość Żaru`.
- Klan ma stały `clanId`, niezależny od nazwy wyświetlanej i nazwy PDF-u.
- Pole `logoFile` w JSON-ie klanu wskazuje plik z `app/src/assets/clans`.
- `rytualisci` są powiązani z `logo-rytualisci.svg`.
- `mechanisci` są powiązani z `logo-mechanisci.svg`.
- `hanzyci` są powiązani z `logo-hanza.svg`.
- `soldaci` są powiązani z `logo-soldaci.svg`.
- Wybór klanu pokazuje cztery kwadratowe kafelki w jednym rzędzie na desktopie.
- Na telefonie kafelki klanów układają się w dwóch kolumnach.
- Nad kafelkami nie ma dodatkowego nagłówka `Wybierz kartę klanu` ani podpisu `Wybierz kartę`.

## Dane i docelowy eksport

- To działanie aplikacji użytkownika, a nie część kreatora szablonów.
- Edytor wczytuje PDF i konfigurację pól wygenerowane w Workshop.
- Użytkownik uzupełnia dane postaci i zaznaczenia.
- Przy eksporcie wybiera zwykły lub interaktywny PDF.
- Zwykły PDF utrwala dane i zaznaczenia.
- Interaktywny PDF zawiera edytowalne pola formularza z wartościami wstępnie ustawionymi w edytorze.
- Dane postaci są oddzielone od układu karty. Pola są powiązane przez stałe identyfikatory.

Odczyt własnych globalnych definicji pól z Workshop pozostaje do wdrożenia.

Powiązane: [[Workshop/kreator-szablonow]], [[Portal/edytor-talentow]], [[start]].
