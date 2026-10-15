# Workshop — Przegląd i import talentów

Adres: [Przegląd i import talentów](http://localhost:8080/#dev-talents). Wejście także z głównego ekranu Workshop.

## Wewnętrzna lista

- Dane zapisujemy w `cardTemplates/talenty/talenty.json`.
- Lista początkowa zawiera 19 talentów z PDF-a, w grupie `Dary Ciemności`, bez podgrup i kodów.
- Edytor pracuje na JSON-ie. Nie zmienia źródłowego XLS-a.
- Edytujemy nazwę, oba opisy, liczbę użyć, grupę i podgrupę. Kod jest tylko do odczytu.
- Edytujemy również flagi talentu, na razie `isDarkGift`. Flaga Daru Ciemności jest niezależna od grupy. Wszystkie talenty korzystają z jednego [[Workshop/kreator-szablonow-talentow|szablonu HTML]].
- Checkbox „Dar Ciemności — pokaż ikonę” zapisuje flagę razem z talentem. Nie ma wyboru typu szablonu.
- Wyszukiwanie obejmuje nazwę, opisy i kod. Filtry obejmują grupę i podgrupę.
- Zapisujemy przyciskiem „Zapisz talent”. Przełączenie talentu z niezapisanymi zmianami wymaga potwierdzenia ich odrzucenia.
- „Odśwież listę” pobiera aktualny stan pliku.

## Import XLS / XLSX

1. Wybieramy plik z jednym arkuszem i pięcioma ustalonymi kolumnami.
2. Ustawiamy grupę i opcjonalną podgrupę dla całego importu. Domyślna grupa to `Dary Ciemności`.
3. „Pokaż podgląd importu” sprawdza dane i pokazuje nowe, zmienione oraz niezmienione talenty. Rozwinięcie wiersza pokazuje importowaną treść.
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

## Zapis i uruchamianie

- Serwer zapisuje JSON przez plik tymczasowy i zachowuje poprzednią wersję w `talenty.json.bak`.
- Zapis ze starszego widoku nie nadpisuje nowszych zmian. Po komunikacie o konflikcie trzeba odświeżyć listę lub ponownie przygotować podgląd importu.
- Katalog `cardTemplates` jest już montowany do kontenera.
- Po zmianie zależności przebudowujemy kontener zgodnie z [[projekt]].
- Moduł i API działają w lokalnym Workshop; nie są częścią Portalu produkcyjnego.
- Ten etap nie obejmuje przydzielania talentów do e-maili, wysyłki ani generowania PDF-a.

Struktura JSON i kody: [[Workshop/talenty_ekskluzyne]]. Rola dotychczasowego [[Workshop/edytor-talentow|Edytora talentów Workshop]] pozostaje do ustalenia, aby nie powielać funkcji.
