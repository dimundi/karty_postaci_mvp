# Import talentów — GoogleDoc

Procedurę wybieramy w „Przegląd i import talentów”. Dotychczasowy import pięciu kolumn pozostaje osobnym wyborem.

## Wybór i podgląd

1. Wybierz „GoogleDoc (nowy)”.
2. Wskaż XLSX, grupę i jedną podgrupę dla całego importu. Podgrupa jest wymagana. Obecne talenty pozostają w `Ogólne`.
3. Ustaw „isDarkGift — Dar Ciemności dla importu”. Początkowo pole jest odznaczone.
4. Opcjonalnie zaznacz „Nadpisz isDarkGift dla wszystkich importowanych talentów”.
5. Przygotuj podgląd. Sprawdź nowe/zmienione/niezmienione talenty, typy i flagi. Podgląd nie zmienia pliku biblioteki.
   Talenty są pokazane jako otwarte, numerowane bloki jeden pod drugim, z pełnymi opisami. Cały obszar Workshop przewija się na wysokości okna, także na telefonie.
6. Dopiero „Zatwierdź import” zapisuje dane. Zmiana opcji, pliku lub podgrupy usuwa wcześniejszy podgląd.

## Mapowanie

Czytamy `Arkusz1`. Pozostałe arkusze są pomijane i wymieniane w podglądzie. Pierwszy niepusty nagłówek musi mieć kolumny B–G:

| Kolumna | Pole |
| --- | --- |
| Nazwa | `name` |
| Akcja | `isAction`: `akcja` lub `tak` → `true`; puste lub `nie` → `false` |
| Opis fabularny | `flavorDescription` |
| Opis mechaniczny | `description` |
| Użycia | `1/scenę` → `oncePerScene: true`, `usesPerMission: 0`; jawne 0–3 → `usesPerMission` i `oncePerScene: false` |
| Typ | `dev_type` |

Kolumna A jest pomocnicza. Kolumny H i dalsze są pomijane, także ich nagłówki i formuły. Formuły i błędy w kolumnach A–G blokują podgląd. Limit: 8 MB i 10 000 talentów.

Import pobiera tekst komórek; nie tłumaczy stylów Excela na znaczniki. Zapisane w treści `**…**`, `*…*`, `[cecha: …]`, `[aspekt: …]` i `[stan: …]` zostają zachowane.

## Flagi i nadpisywanie

- Nowy talent otrzymuje `isDarkGift` z formularza.
- GoogleDoc ustawia `oncePerScene` na podstawie kolumny Użycia także przy aktualizacji istniejącego talentu. Podgląd pokazuje „Raz na scenę: tak/nie”.
- Istniejący talent zachowuje tę flagę, jeśli nadpisanie jest wyłączone.
- Z nadpisaniem każdy talent objęty importem otrzymuje wybraną wartość, również `false`.
- Talenty nieobecne w imporcie nie zmieniają się.
- GoogleDoc aktualizuje `isAction` z kolumny Akcja i `dev_type` z kolumny Typ. Dotychczasowy importer zachowuje istniejące flagi i `dev_type`, z wyjątkiem jawnie włączonego nadpisania `isDarkGift`.
- Dopasowanie nadal korzysta z nazwy, grupy i podgrupy (lub kodu w starym formacie). ID oraz istniejący kod zostają zachowane. Zmiana podgrupy importu nie przenosi automatycznie talentu z innej podgrupy.
- Zapis ma ochronę rewizji, kopię `.bak` i atomową podmianę pliku.

## Typy

`dev_type` to opcjonalne pole administracyjne. Nie wybiera szablonu i nie dopisuje tekstu do karty.

- W edycji talentu jest listą wyboru „dev_type — Typ”, z opcją „Brak typu”.
- Dostępne wartości to suma katalogu `app/src/talentTemplates/dev-types.json` i typów zapisanych w bibliotece. Podgląd importu uwzględnia również typy z wybranego pliku.
- Katalog zawiera dziesięć typów z dostarczonego XLSX, z zachowaniem ich oryginalnej pisowni.
- Starszy talent bez pola jest odczytywany z `dev_type: null`. Biblioteka nie jest migrowana samym otwarciem strony.

## Sprawdzenie

`docker compose exec app node scripts/verify-googledoc-talents.cjs`

Test sprawdza parser, podgrupę, typy, flagi, zachowanie ID/kodu, brak zmian poza importem i wybór procedury, edycję, podgląd oraz zapis przez UI. Używa osobnej biblioteki tymczasowej. Nie importuje rzeczywistego pliku do biblioteki użytkownika.
