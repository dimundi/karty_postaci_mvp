# Wspólne założenia projektu

Podział aplikacji: [[start]].

Budujemy aplikację etapami, zaczynając od MVP do publicznego pokazu. Dbamy o czytelny polski interfejs, stabilne działanie i poprawny eksport PDF.

## Technologia i uruchamianie

- Prosta aplikacja webowa w React.
- Kod aplikacji piszemy w TypeScript.
- Projekt budujemy za pomocą Webpacka.
- Projekt uruchamiamy w kontenerze.
- Build produkcyjny generujemy w kontenerze.
- Na serwer produkcyjny wysyłamy tylko wygenerowany build.
- Pliki projektu React znajdują się w katalogu `app` montowanym do kontenera.
- Po zmianie zależności lub konfiguracji Webpacka odświeżamy kontener developerski: `docker compose up -d --build --force-recreate --renew-anon-volumes app`. Odtwarza to również wolumen `node_modules` z aktualnego obrazu.
- Gotowy build jest zapisywany w katalogu `build`.
- Produkcyjny build można uruchomić plikiem `build.bat` z głównego katalogu projektu.

## Dane

- Obecnie przechowujemy dane w plikach JSON.
- Zachowujemy stałe identyfikatory i oddzielamy odczyt oraz zapis danych od interfejsu i eksportu, aby ułatwić migrację do bazy danych.
- Dalsze wymagania: [[wymagania-uzytkownika]].

## Styl graficzny

- https://whatthefrog.pl/download/Klanarchia/
- https://whatthefrog.pl/klanarchia/
- https://gamefound.com/en/projects/whatthefrog/klanarchia?ref=search
- Lokalne assety interfejsu znajdują się w `app/src/assets`.
- Używamy oficjalnego logo Klanarchii, tła Rubieży, faviconu i logo What The Frog.
