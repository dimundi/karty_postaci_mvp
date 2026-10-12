# Budowanie szablonów i edytor postaci

Docelowo pracę dzielimy na dwa etapy. HTML jest źródłem układu karty. Edytor postaci korzysta z wygenerowanego szablonu PDF.

## Etap 1 — Budowanie szablonu karty

- Układ karty tworzymy w HTML na podstawie materiałów użytkownika.
- Definicje pól mają stałe identyfikatory, niezależne od etykiet i języka.
- Z HTML generujemy szablon PDF oraz konfigurację pozycji i rozmiarów pól.
- Pozycje w konfiguracji muszą odpowiadać wygenerowanemu PDF-owi. Nie ustawiamy ich ponownie ręcznie.
- Z tego samego źródła przygotowujemy wersję karty dostosowaną do Roll20.
- Eksport do Roll20 wymaga osobnego dostosowania HTML i mapowania pól na atrybuty platformy.

## Etap 2 — Edytor postaci

- Edytor wczytuje PDF i konfigurację pól wygenerowane w etapie 1.
- Użytkownik uzupełnia dane postaci i zaznaczenia.
- Przy eksporcie wybiera zwykły lub interaktywny PDF.
- Zwykły PDF utrwala dane i zaznaczenia.
- Interaktywny PDF zawiera edytowalne pola formularza z wartościami wstępnie ustawionymi w edytorze.
- Dane postaci są oddzielone od układu karty. Pola są powiązane przez stałe identyfikatory.

## Stan obecny i dalsze prace

- Na obecnym etapie bazę danych aplikacji budujemy jako pliki JSON.
- Docelowo przeniesiemy dane z JSON do bazy danych.
- Zachowujemy stałe identyfikatory i oddzielamy odczyt oraz zapis danych od interfejsu i eksportu, aby ułatwić późniejszą migrację.

- Obecne MVP korzysta z dostarczonych PDF-ów i konfiguracji JSON. Pozycje pól ustawia edytor techniczny.
- Budowanie szablonów z HTML i eksport do Roll20 są do wdrożenia.
- Automatyczne generowanie konfiguracji pól zastąpi ręczne ustalanie pozycji dla szablonów tworzonych z HTML.
- Sposób budowania HTML oraz narzędzia do eksportu PDF i Roll20 ustalimy przed wdrożeniem etapu 1.

Powiązane: [[zalozenia]], [[wymagania-uzytkownika]].
