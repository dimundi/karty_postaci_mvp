# Workshop — Przegląd i import talentów

Adres: [Przegląd i import talentów](http://localhost:8080/#dev-talents). Wejście także z głównego ekranu Workshop.

## Wewnętrzna lista

- „Nowy talent” otwiera pusty formularz, bez zapisu do biblioteki. Grupę i podgrupę przejmuje z filtrów; bez filtra grupy proponuje `Dary Ciemności`. Flagi są wyłączone, użycia wynoszą 0. „Zapisz talent” nadaje UUID i dodaje rekord z pustym kodem. Obowiązują walidacja pól, kontrola duplikatów i rewizji oraz kopia `.bak`. Odrzucenie zmian usuwa niezapisany formularz.

- Przyciski formatowania opisu pomijają białe znaki na początku i końcu zaznaczenia. Spacje pozostają poza znacznikami; zaznaczenie samych białych znaków niczego nie zmienia. Bez zaznaczenia nadal wstawiana jest pusta para znaczników.

- 2026-10-22: usunięto 21 talentów z `Dary Ciemności / Ekskluzywne` przed ponownym importem. Pozostało 19 talentów. Kopia: `cardTemplates/talenty/talenty.json.before-exclusive-removal-20261022-144734.bak`.

- Zaznaczone `oncePerScene` pokazuje ikonę `app/src/assets/once.svg` w prawym górnym rogu karty, za kwadratami użyć, jeśli także je ustawiono. Wspólny renderer stosuje ją w podglądzie, PDF i grafice mailingowej. Serwer przycina pusty obszar SVG podczas odczytu, bez zmiany pliku źródłowego. Wcześniejsze materiały wymagają ponownego przygotowania.

- „Ile razy można użyć na misję” i „Raz na scenę” są w jednym wierszu edytora. Znaczeniowo się wykluczają, ale formularz i API nie sprawdzają tej zależności.

- `oncePerScene` — flaga „Raz na scenę”, zmieniana checkboxem w edytorze i zapisywana przyciskiem „Zapisz talent”. Wszystkie 40 istniejących talentów otrzymało `false`; kopia sprzed migracji: `talenty.json.before-once-per-scene.bak`. Brak pola w starszych danych oznacza `false`. Import pięciu kolumn nadaje nowym talentom `false` i zachowuje flagę istniejących. GoogleDoc odczytuje kolumnę Użycia: `1/scenę` ustawia `oncePerScene: true` i `usesPerMission: 0`, a liczby 0–3 ustawiają `oncePerScene: false`. Dotyczy to także aktualizacji istniejących talentów.

- Dane zapisujemy w `cardTemplates/talenty/talenty.json`.
- Lista początkowa zawiera 19 talentów z PDF-a, w grupie `Dary Ciemności`. Wszystkie przypisano do utworzonej przez użytkownika podgrupy `Ogólne`. Zmiana dotyczyła wyłącznie podgrupy, z kopią listy przed zapisem.
- Edytor pracuje na JSON-ie. Nie zmienia źródłowego XLS-a.
- Edytujemy nazwę, oba opisy, liczbę użyć, grupę i podgrupę. Kod jest tylko do odczytu.
- Edytujemy również flagi talentu, na razie `isDarkGift`. Flaga Daru Ciemności jest niezależna od grupy. Wszystkie talenty korzystają z jednego [[Workshop/kreator-szablonow-talentow|szablonu HTML]].
- Środkowy formularz zaczyna się od opisu fabularnego, potem opisu talentu i parametrów: `isDarkGift`, `isAction`, liczby użyć oraz kodu. Checkbox „isDarkGift — Dar Ciemności (pokaż ikonę)” zmienia ikonę w podglądzie i zapisuje flagę razem z talentem. Nie ma wyboru typu szablonu.
- `isAction — Akcja` steruje dopiskiem „(akcja)” po nazwie, przed dwukropkiem. Nazwa w danych nie zawiera dopisku. Wspólny szablon stosuje flagę w podglądzie, PDF i grafice mailingowej; kreator szablonów ma również tę flagę w danych podglądu.
- Istniejącą bibliotekę zmigrowano: dopisek usunięto z czterech nazw i ustawiono im `isAction: true`; pozostałe talenty otrzymały `false`. ID, kody, grupy, podgrupy, opisy i pozostałe parametry zachowano. Przed zapisem powstała kopia `talenty.json.before-action-flag-<czas>.bak`.
- Stary pięciokolumnowy import rozpoznaje dopisek „(akcja)” w nazwie i usuwa go z pola nazwy, aby rozpoznać istniejący talent. Nowy talent z takim dopiskiem otrzymuje `isAction: true`; pozostałe `false`. Import zachowuje flagę istniejącego talentu. Nie dodajemy kolumn ani nie zmieniamy formatu starego pliku.
- Niezapisane zmiany wyróżnia czerwony przycisk „Zapisz talent”, z podpowiedzią „Niezapisane zmiany”. Nie dodajemy komunikatu zmieniającego wysokość formularza. Po zapisie lub odrzuceniu zmian przycisk wraca do zwykłego wyglądu i jest nieaktywny.
- Potwierdzenia zapisu i importu pojawiają się w prawym dolnym rogu na 3,5 sekundy. Nie przesuwają formularza i nie przechwytują kliknięć.
- Wyszukiwanie obejmuje nazwę, opisy i kod. Filtry obejmują grupę i podgrupę.
- Wyszukiwanie, grupa i podgrupa są w jednym pasku na całą szerokość nad obszarem pracy. Po lewej jest zwarta lista talentów, po prawej edytor wykorzystujący pozostałą szerokość. Na telefonie wyszukiwanie jest nad dwoma filtrami, a lista nad edytorem.
- Na szerokim ekranie po prawej stronie edytora jest podgląd karty wybranego talentu. Reaguje na niezapisane zmiany nazwy, opisów, użyć i flagi Daru Ciemności. Korzysta z zapisanego wspólnego szablonu oraz tej samej funkcji renderowania i dopasowania tekstu co eksport. Pokazuje ostrzeżenie, jeśli tekst się nie mieści. Podgląd nie zapisuje talentu. Na węższych ekranach znajduje się pod edytorem.
- Nazwa, grupa i podgrupa są edytowane w prawej kolumnie, nad podglądem karty. Należą do tego samego formularza co opisy i flagi; przycisk „Zapisz talent” zapisuje wszystkie pola, z walidacją wymaganej nazwy i grupy.
- Opisy edytujemy wyłącznie w formularzu. Edycję bezpośrednio na karcie wycofano, ponieważ podczas pisania zmieniała dzielenie wyrazów. Karta jest tylko podglądem: aktualizuje się podczas zmian formularza, z docelowym składem i dopasowaniem tekstu. Nie zawiera pól edycji, podpowiedzi ani dodatkowych odstępów za puste opisy.
- Tekst karty nie może mieć mniej niż 9 pt. Domyślna wielkość i minimum to 9 pt. Przy przepełnieniu pokazujemy ostrzeżenie, a eksport blokujemy zamiast zmniejszać tekst poniżej minimum. Siedem linii przy interlinii 1,12 mieści się w sprawdzonym układzie z ikonami.
- Pod „Opisem talentu” są przyciski obejmujące zaznaczony tekst znacznikami: `**tekst**` (pogrubienie), `*tekst*` (kursywa), `[cecha: tekst]`, `[aspekt: tekst]`, `[stan: tekst]`. Bez zaznaczenia wstawiają pustą parę znaczników z kursorem w środku. To edycja tekstu źródłowego; przyciski nie zapisują talentu.
- Pogrubienie i kursywa mają przyciski `B` i `I`, z dostępnymi nazwami i podpowiedziami. „Usuń formatowanie” jest po prawej stronie paska. Usuwa gwiazdki oraz znaczniki cechy, aspektu i stanu z całego opisu talentu, również zagnieżdżone. Zachowuje treść i podziały wierszy, bez automatycznego zapisu.
- Czcionka karty: dołączona Linux Libertine, zgodnie z oryginałem. Pliki skopiowano bez zmian z lokalnych czcionek użytkownika do `app/src/assets/fonts`: `LinLibertine_R.ttf`, `LinLibertine_RB.ttf`, `LinLibertine_RI.ttf`, `LinLibertine_RBI.ttf` i `LinLibertine_RZ.ttf` (semibold, waga 600, prawdziwe kapitaliki OpenType `smcp`). Metadane wskazują Philippa H. Polla; wersje regular/italic/bold italic to 5.1.3, bold to 5.0.3.
- Podgląd w edytorze, kreator szablonów, PDF i karta w grafice mailingowej korzystają z tych samych pięciu odmian przez `@font-face`. Usunięto pierwszeństwo systemowych Georgia/Times; `font-synthesis: none` wyłącza sztuczne pogrubienie i pochylenie. Podgląd czeka na wczytanie odmian przed ostatecznym dopasowaniem tekstu. Pozostałe napisy grafiki reklamowej i fonty interfejsu nie były zmieniane.
- Licencja i informacja o autorze: `app/src/assets/fonts/LinuxLibertine-OFL.txt`. Build kopiuje je do `assets/LinuxLibertine-OFL.txt` obok zasobów aplikacji. Oryginalne metadane licencyjne pozostają w plikach TTF.
- Test `docker compose exec app node scripts/verify-talent-fonts.cjs` sprawdza style cechy, aspektu i stanu, faktycznie użyte pięć odmian w Chromium i osadzone fonty w PDF wygenerowanym przez eksporter. Pracuje na przykładowych danych, bez zmiany biblioteki talentów. Istniejące pliki PDF/grafiki nie zmieniają się automatycznie; trzeba wygenerować je ponownie.
- Sprawdzono możliwość użycia na WWW i w PDF: Linux Libertine jest udostępniana na OFL ([dystrybucja CTAN](https://ctan.org/tex-archive/fonts/libertine)). OFL pozwala na osadzanie i dystrybucję w aplikacji, również komercyjnej; do plików czcionki dołączamy informację o autorach i właściwą licencję pobranego wydania. Dokumenty utworzone tą czcionką nie muszą być na OFL. Źródła: [licencja](https://openfontlicense.org/open-font-license-official-text/), [FAQ — użycie na stronie i osadzanie](https://openfontlicense.org/ofl-faq/). Przy wdrożeniu zachowujemy oryginalną licencję konkretnego pakietu fontów.
- W opisie talentu wspólny renderer zamienia `**tekst**` na pogrubienie, `*tekst*` na kursywę, a `***tekst***` na oba style. Działa w podglądzie, PDF i grafice. Kursywa w opisie działania zachowuje jego kolor. Niedomknięte znaczniki zostają tekstem. HTML użytkownika nie jest interpretowany. Wcześniej zapisane materiały mailingowe wymagają ponownego przygotowania podglądu.
- `[stan: tekst]` → kapitaliki (`small-caps`) i semibold 600; `[aspekt: tekst]` → tło `#b1b7c6`; `[cecha: tekst]` → pogrubienie i kursywa. Znaczniki mogą być zagnieżdżone i łączone z gwiazdkami. W danych zachowujemy zapis źródłowy; samych znaczników nie pokazujemy na karcie ani w eksporcie.
- Przyciski „Zapisz talent” i „Odrzuć zmiany” są po prawej stronie nagłówka „Edycja talentu”. Informacja o roli grup jest pod polami grupy i podgrupy. Podgląd nie ma osobnego nagłówka ani opisu bieżących zmian. Usunięto objaśnienie niezależności flagi i link do wspólnego szablonu z formularza.
- Zapisujemy przyciskiem „Zapisz talent”. Przełączenie talentu z niezapisanymi zmianami wymaga potwierdzenia ich odrzucenia.
- Zmiana filtra grupy lub podgrupy również sprawdza niezapisane zmiany. Anulowanie zachowuje filtr i edycję. Potwierdzenie odrzuca zmiany przed zastosowaniem filtra. Pola grupy i podgrupy w edytorze nadal służą do edycji danych, bez tego potwierdzenia.
- „Odśwież listę” pobiera aktualny stan pliku.

## Import XLS / XLSX

W formularzu jest wybór „Procedura importu”: **XLS / XLSX — 5 kolumn (dotychczasowy)** i **GoogleDoc (nowy)**. Obie procedury są dostępne. GoogleDoc czyta `Arkusz1` z eksportu XLSX. „Akcja” trafia do `isAction`, „Typ” do osobnego `dev_type`, a wspólną podgrupę wybieramy w formularzu. Przed importem ustawiamy `isDarkGift` i opcjonalne nadpisanie tej flagi dla wszystkich importowanych talentów. Szczegóły: [[Workshop/import-googledoc]]. Sam podgląd ani wybór procedury nie importuje danych.

1. Wybieramy plik z jednym arkuszem i pięcioma ustalonymi kolumnami.
2. Ustawiamy grupę i opcjonalną podgrupę dla całego importu. Domyślna grupa to `Dary Ciemności`.
3. „Pokaż podgląd importu” sprawdza dane i pokazuje nowe, zmienione oraz niezmienione talenty w otwartych, numerowanych blokach z pełną treścią. Obszar Workshop ma własne przewijanie na wysokości okna.
4. Dopiero „Zatwierdź import” zapisuje zmiany wewnętrznej listy.

- Import nie usuwa talentów nieobecnych w pliku.
- Talent rozpoznajemy po kodzie. Gdy kod nie wskazuje istniejącego talentu, sprawdzamy nazwę, grupę i podgrupę.
- Porównanie nazw, grup i podgrup pomija wielkość liter oraz spacje na początku i końcu.
- Wewnętrzne ID zostaje zachowane. Nowy rekord otrzymuje UUID.
- Import nie przypisuje typu szablonu. Zachowuje istniejącą flagę `isDarkGift`. Nowy talent z pięciokolumnowego XLS-a otrzymuje `false`; flagę można później zmienić w edytorze, niezależnie od grupy.
- Nadany kod zostaje zachowany również wtedy, gdy komórka kodu jest pusta. Inny niepusty kod dla tego samego talentu blokuje import.
- Zmiana nazwy talentu bez kodu w arkuszu spowoduje dodanie nowego rekordu. Nazwę istniejącego talentu najlepiej zmieniać w edytorze.
- Duplikaty, konflikty kodów, formuły i nieprawidłowa liczba użyć blokują import.
- Limity: 8 MB, 10000 talentów i pięć kolumn. Liczba użyć musi być jawnie podana jako `0`, `1`, `2` lub `3`.

## Plik wzorcowy GoogleDoc

- Plik: `klanarchiaDoc/Workshop/talenty/Dary Ciemności.xlsx`. Nie został zaimportowany.
- Obsługuje go nowa procedura GoogleDoc. Procedura pięciu kolumn nadal wymaga swojego dotychczasowego układu.
- `Arkusz1`: 21 talentów, nagłówek w wierszu 2, pusty wiersz 1. Zakres formatowania sięga `AA1001`; nie jest to liczba talentów ani rzeczywiście użytych kolumn danych.
- Kolumny A–G: `Kolumna nr 1`, `Nazwa`, `Akcja`, `Opis fabularny`, `Opis mechaniczny`, `Użycia`, `Typ`. Brak kolumny kodu.
- W pierwszym arkuszu wszystkie talenty mają opis mechaniczny. Brak powtórzonych nazw. Użycia: 12 talentów ma 0, 5 ma 1, 4 mają 3. W kolumnie `Akcja` trzy talenty mają tekst `akcja`; pozostałe komórki są puste lub bez wartości.
- `Arkusz2`: dwa wpisy bez nagłówka — „Mroczny serafin” i „Towarzysz Mruk”. Użycia odpowiednio `□` i puste; w kolumnie `Akcja` odpowiednio `tak` i puste.
- W arkuszach nie znaleziono formuł.
- Bezpośrednie mapowanie: `Nazwa` → `name`, `Opis fabularny` → `flavorDescription`, `Opis mechaniczny` → `description`, `Użycia` → `usesPerMission` (tylko jawne 0–3).
- `Typ` trafia do osobnego pola `dev_type`, nie do podgrupy. `Akcja` steruje `isAction`. W podglądzie wskazujemy pominięcie `Arkusz2`.
- Flaga `isDarkGift` pozostaje niezależna od grupy. Jej ustawienia dla nowego importu nie wyprowadzamy automatycznie z nazwy pliku.

## Zapis i uruchamianie

- Serwer zapisuje JSON przez plik tymczasowy i zachowuje poprzednią wersję w `talenty.json.bak`.
- Zapis ze starszego widoku nie nadpisuje nowszych zmian. Po komunikacie o konflikcie trzeba odświeżyć listę lub ponownie przygotować podgląd importu.
- Katalog `cardTemplates` jest już montowany do kontenera.
- Po zmianie zależności przebudowujemy kontener zgodnie z [[projekt]].
- Moduł i API działają w lokalnym Workshop; nie są częścią Portalu produkcyjnego.
- Ten etap nie obejmuje przydzielania talentów do e-maili, wysyłki ani generowania PDF-a.

Struktura JSON i kody: [[Workshop/talenty_ekskluzyne]]. Rola dotychczasowego [[Workshop/edytor-talentow|Edytora talentów Workshop]] pozostaje do ustalenia, aby nie powielać funkcji.
