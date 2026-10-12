# Budowanie szablonów i edytor postaci

Docelowo pracę dzielimy na dwa etapy. HTML jest źródłem układu karty. Edytor postaci korzysta z wygenerowanego szablonu PDF.

## Etap 1 — Budowanie szablonu karty

- Układ karty tworzymy w HTML na podstawie materiałów użytkownika.
- Definicje pól mają stałe identyfikatory, niezależne od etykiet i języka.
- Z HTML generujemy szablon PDF oraz konfigurację pozycji i rozmiarów pól.
- Pozycje w konfiguracji muszą odpowiadać wygenerowanemu PDF-owi. Nie ustawiamy ich ponownie ręcznie.
- Z tego samego źródła przygotowujemy wersję karty dostosowaną do Roll20.
- Eksport do Roll20 wymaga osobnego dostosowania HTML i mapowania pól na atrybuty platformy.
- Kreator pod `#dev` przebudowujemy w tej samej aplikacji. Nie tworzymy drugiego kreatora.
- Format strony jest stały: A4 w orientacji pionowej, 210 × 297 mm.
- Warstwy otrzymują domyślne nazwy „0”, „1” itd. Nazwa nie określa kolejności i nie zmienia się przy przesuwaniu. Kolejność nakładania wynika z listy: najwyższa warstwa jest na jej górze. Nazwę edytujemy dwukrotnym kliknięciem; zapisuje się w JSON. Każda warstwa mieści wiele elementów; można zmieniać kolejność warstw, ukrywać je i blokować.
- Kreator definiuje cały szablon: format strony, tło, ozdobniki, stałe teksty, wygląd i rozmieszczenie pól.
- Wynikiem działania kreatora jest PDF oraz JSON z definicjami pól. W obecnej wersji gotowy PDF jest wejściem, a kreator zapisuje tylko JSON.
- Nowy sposób budowania sprawdzamy najpierw na jednej karcie.

## Warianty

- Jeden projekt zawiera warstwy i warianty kart.
- Element może być przypisany do jednego lub kilku wariantów. Elementy bez przypisania są wspólne dla wszystkich wariantów.
- W kreatorze można wyświetlać jeden lub kilka wariantów jednocześnie, aby porównywać rozmieszczenie elementów.
- Przy eksporcie wybieramy jeden wariant. Eksport obejmuje jego elementy oraz elementy wspólne, z uwzględnieniem widoczności warstw.
- Zmiana elementu wspólnego dotyczy wszystkich wariantów, bez kopiowania go między kartami.
- Atrybuty mają wspólne definicje i stałe identyfikatory niezależne od wariantu karty.
- Osobny projekt obejmuje cztery warianty klanów, a osobny — warianty archetypów.
- Kreator jest uniwersalny. Użytkownik tworzy projekty „Klany” i „Archetypy” w tym samym narzędziu; poszczególne karty definiuje wariantami.
- Grafiki pozostają w katalogu link. JSON projektu przechowuje odwołania do nich.
- Zapisane projekty przełączamy w górnym pasku. Warianty przełączamy wyłącznie w skrajnej prawej kolumnie „Warstwy i warianty”, wspólnej dla wariantów, warstw i obiektów. Kliknięcie nazwy wybiera kartę do podglądu; zaznaczenia obok pozwalają porównać kilka wariantów naraz.
- Hamburger w lewym górnym rogu zawiera rzadkie działania: tworzenie projektu i wariantu oraz edycję ich metryk. Tworzenie wariantu jest aktywne po utworzeniu lub otwarciu projektu.
- Przypisania ustawiamy we właściwościach elementu. Brak zaznaczeń oznacza element wspólny. Widoczność wariantów w podglądzie nie zmienia ich przypisań ani eksportu.
- Nowy obiekt trafia na aktywną warstwę i do podświetlonego wariantu. Jeśli nie ma wybranego wariantu, powstaje jako wspólny. Przypisanie można później zmienić we właściwościach.
- Zapis projektu zapamiętuje podświetlony wariant i warianty widoczne w podglądzie. Otwarcie projektu odtwarza ten widok, niezależnie od wariantu ostatnio wyeksportowanego.
- Wariant do eksportu wybieramy dopiero w oknie otwieranym przyciskiem „Generuj”. Ten wybór jest niezależny od wariantów pokazywanych w kreatorze.
- Projekt zapisuje wszystkie warianty w jednym `projekt.json`. Eksporty trafiają do `warianty/<id-wariantu>/` wewnątrz katalogu projektu, dzięki czemu nie nadpisują innych wariantów.
- Starsze projekty bez wariantów nadal działają; dotychczasowe elementy są wspólne.
- Test wariantów: `docker compose exec app node scripts/verify-card-variants.cjs`.

## Globalne definicje pól

- Menu hamburgera → „Definicja pól” otwiera bibliotekę wspólną dla wszystkich projektów.
- Biblioteka pokazuje listę pól, przycisk „Dodaj” i „Edytuj” przy każdym polu. Formularz otwiera się tylko dla dodawanej lub edytowanej definicji; „Zapisz” zapisuje ją globalnie.
- Nowa definicja ma własne ID, nazwę i typ: tekst lub checkbox. ID istniejącej definicji pozostaje stałe.
- Definicje zapisujemy w `cardTemplates/definicje-pol.json`, poza katalogami projektów.
- Dla checkboxu definiujemy sposób liczenia: niezależne zaznaczenie albo liczba zaznaczonych wystąpień, jak dla Żaru.
- Nie definiujemy liczby pól ani typu „grupa checkboxów”. Liczba wystąpień wynika z obiektów umieszczonych na karcie. Eksport kreatora nie ogranicza Żaru ani mrocznego instynktu do trzech pól.
- Przycisk „Pole” otwiera wybór globalnej definicji pasującej do projektu. Następnie klikamy miejsce na karcie. Obiekt zapisuje odwołanie do definicji, a jego pozycja i wygląd należą do szablonu.
- Dostępne są także własne definicje dodane do biblioteki. Eksport pól zawiera ID definicji i sposób liczenia wartości.
- Globalna definicja określa nazwę, szerokość, wysokość, wielkość czcionki i znak zaznaczenia. Obiekty przypisane do definicji dziedziczą te parametry; na karcie edytujemy pozycję, warstwę i warianty.
- Zapis definicji aktualizuje powiązane pola w otwartym kreatorze. Inne projekty odczytują aktualne ustawienia przy otwarciu i eksporcie.
- Odczyt własnych definicji w aplikacji użytkownika pozostaje do wdrożenia.

## Talenty — do wdrożenia

- Powstanie osobny kreator talentów do tworzenia i edycji ich treści oraz zapisu we wspólnej bazie JSON.
- Kreator talentów pozwoli tworzyć własne listy talentów i eksportować je do PDF.
- Talent zawiera nazwę, opis fabularny, test i atrybuty. Atrybuty ustalimy w trakcie pracy na materiałach użytkownika.
- Talent wyświetlamy w prostokątnej ramce o stałym rozmiarze. Wymiary i układ ramki definiujemy globalnie.
- W kreatorze kart pojawi się przycisk „Talent”. Użytkownik wskaże talent na liście i umieści go na karcie w gotowej ramce.
- Cała ramka talentu jest jednym obiektem. Projekt karty zapisuje odwołanie do talentu oraz pozycję, warstwę i warianty obiektu; treść pochodzi ze wspólnej bazy.
- Źródło i sposób importu treści talentów pozostają do ustalenia.

## Etap 2 — Edytor postaci

- To działanie aplikacji użytkownika, a nie część kreatora szablonów.
- Edytor wczytuje PDF i konfigurację pól wygenerowane w etapie 1.
- Użytkownik uzupełnia dane postaci i zaznaczenia.
- Przy eksporcie wybiera zwykły lub interaktywny PDF.
- Zwykły PDF utrwala dane i zaznaczenia.
- Interaktywny PDF zawiera edytowalne pola formularza z wartościami wstępnie ustawionymi w edytorze.
- Dane postaci są oddzielone od układu karty. Pola są powiązane przez stałe identyfikatory.

## Tło i interaktywność w Roll20

- Pustą kartę PDF można zamienić na PNG i użyć jako tła karty w Roll20.
- Tło zapewnia wygląd. Na nim umieszczamy pola HTML powiązane z atrybutami Roll20, które umożliwiają edycję i zapis danych.
- Sam obraz nie zapewnia interaktywności.
- Na początek wystarczą pola do wypełniania. Przyciski rzutów i automatyczne obliczenia można dodać później.
- Nie trzeba odtwarzać ozdobników w HTML, jeśli znajdują się już na tle.

## Wersje językowe

- Jeden szablon logiczny może obsługiwać PL i EN, ze wspólnymi identyfikatorami pól.
- Jeśli napisy są częścią tła, potrzebne są osobne tła PL i EN. Wybór języka przełącza tło i etykiety, zachowując dane postaci.
- Jeśli napisy są tekstem HTML, można użyć wspólnego tła bez napisów i tłumaczeń w JSON.
- Konfiguracje pozycji pól mogą być osobne dla języków, jeśli układy kart się różnią.

## PDF do profesjonalnego druku

- Wykonalny jest eksport PDF z CMYK, właściwym profilem ICC i odpowiednią rozdzielczością obrazów.
- Można przygotować osobny eksport dla drukarni, uwzględniający jej wymagania dotyczące profilu, spadów i standardu PDF/X.
- W eksporcie do druku warto zachować wektorowe teksty i linie. PNG może służyć jako tło dla Roll20 i podglądu.
- Obecny eksport nie zapewnia jeszcze przygotowania pliku do profesjonalnego druku. Narzędzia i parametry ustalimy przed wdrożeniem.

## Obsługa uniwersalnego kreatora szablonów

- Obszar roboczy wykorzystuje całą wysokość okna. Domyślny widok „Cała strona” pokazuje całą kartę; dostępne są też dopasowanie do szerokości i ręczne powiększenie.
- Przybliżanie i oddalanie: przyciski `+` i `−` lub `Ctrl + kółko myszy` nad obszarem roboczym. Zoom kółkiem skupia się na miejscu pod kursorem. Samo kółko przewija kartę.
- Biblioteka elementów do dodawania jest na górze lewego panelu. Warstwy zajmują pojedyncze wiersze w prawym panelu.
- Po prawej są dwie osobno przewijane kolumny: skrajna zawiera warstwy i obiekty aktywnej warstwy, a kolumna po jej lewej — właściwości wybranego elementu.
- Obie prawe kolumny można niezależnie zwijać przyciskiem strzałki w nagłówku. Zostaje wąski pasek do rozwinięcia, a obszar roboczy przejmuje wolne miejsce.
- Bloki „Warstwy” i „Warianty” w wspólnej kolumnie można niezależnie zwijać kliknięciem ich nagłówka. Lista obiektów pozostaje dostępna.
- Właściwości elementu są podzielone na zwijane bloki: pozycja, rozmiar, tekst lub ustawienia pola. Warstwa i przypisania do wariantów znajdują się na końcu.
- Metryki projektu i wybranego wariantu otwieramy z hamburgera. Edycja odbywa się w osobnym oknie.

- Wejście: `#dev` → „Kreator szablonów” (`#dev-templates`). Starsze adresy `#dev-clans` i `#dev-archetypes` otwierają ten sam kreator.
- Typ karty „Klan” lub „Archetyp” określa dostępne pola i konfigurację eksportowaną dla aplikacji użytkownika. Dla archetypu obsługujemy pola „Imię lub przydomek” i „Nazwa klanu”.
- Grafiki PNG, JPG, WebP i SVG pobieramy z `cardTemplates/link` lub `Links`. Jeśli takiego katalogu nie ma, kreator korzysta z dotychczasowego `cardTemplates/klany/Links`.
- Po dodaniu pliku do katalogu można odświeżyć listę grafik w kreatorze.
- Lewy panel pokazuje przyciski „Obraz” i „Tekst” z ikonami. Lista grafik z katalogu Links pojawia się dopiero w oknie wyboru obrazu.
- Wybieramy warstwę, grafikę lub rodzaj elementu i klikamy miejsce na stronie. Elementy można przesuwać, skalować uchwytem i ustawiać liczbowo.
- Pozycje i rozmiary zapisujemy w punktach PDF, z początkiem w lewym górnym rogu. 72 pt odpowiada jednemu calowi.
- „Zapisz projekt” zapisuje tylko projekt do dalszej edycji. „Generuj HTML + PDF + JSON” zapisuje komplet plików.
- „Zapisz projekt” znajduje się w rozwijanym menu hamburgera, z oznaczeniem skrótu `Ctrl+S`.
- Skrót `Ctrl+S` zapisuje projekt zamiast otwierać zapis strony przeglądarki (`Cmd+S` na macOS). Komunikat udanego zapisu znika po 5 sekundach; błędy pozostają widoczne.
- `Ctrl+Z` (`Cmd+Z` na macOS) cofa zmiany projektu, do 100 operacji. Przeciągnięcie lub skalowanie uchwytem jest jedną operacją. W polach tekstowych skrót zachowuje zwykłe cofanie wpisywanego tekstu. Otwarcie innego projektu czyści historię.
- Przy pierwszym zapisie bez podanej nazwy kreator pyta o nazwę projektu. Nazwy mogą zawierać polskie litery i spacje. Błąd zapisu pojawia się w oknie komunikatu.
- Nowe projekty mają osobne katalogi `cardTemplates/projekty/<nazwa>/`, np. `Klany` i `Archetypy`. `projekt.json` jest wspólny, a pliki `karta.html`, `karta.pdf` i `pola.json` powstają w katalogach wariantów.
- Dotychczasowe projekty w `cardTemplates/klany` nadal są dostępne i zapisują się w swoim dotychczasowym miejscu.
- `projekt.json` przechowuje warstwy, elementy i odwołania do grafik. `pola.json` jest konfiguracją dla aplikacji użytkownika.
- HTML zawiera osadzony font i grafiki. PDF generuje Chromium w kontenerze z tego HTML. Ukryte warstwy nie trafiają do eksportu.
- Oznaczenia i etykiety pól są pomocnicze. W PDF pojawia się tylko obramowanie pola, jeśli włączono jego drukowanie.
- Przed użyciem karty w aplikacji użytkownika kopiujemy `karta.pdf` i `pola.json` do `pdfTemplates/klany` lub `pdfTemplates/archetypy`, zależnie od typu karty, pod wspólną nazwą bazową. W skopiowanym JSON-ie ustawiamy `templateFile` na nazwę skopiowanego PDF-u.
- Test kreatora: `docker compose exec app node scripts/verify-card-creator.cjs`. Sprawdza obsługę w przeglądarce, zapis i odczyt, warstwy, eksport HTML i PDF A4 oraz konfigurację pól.

## Stan obecny i dalsze prace

- Na obecnym etapie bazę danych aplikacji budujemy jako pliki JSON.
- Docelowo przeniesiemy dane z JSON do bazy danych.
- Zachowujemy stałe identyfikatory i oddzielamy odczyt oraz zapis danych od interfejsu i eksportu, aby ułatwić późniejszą migrację.

- Aplikacja użytkownika nadal korzysta z PDF-ów i konfiguracji JSON w `pdfTemplates`.
- Uniwersalny kreator buduje projekty i warianty szablonów warstwowych oraz generuje HTML, PDF i konfigurację pól. Konfiguracja pochodzi z tych samych pozycji co HTML.
- Eksport do Roll20, tłumaczenia i przygotowanie PDF-u dla drukarni pozostają do wdrożenia.

Powiązane: [[zalozenia]], [[wymagania-uzytkownika]].
