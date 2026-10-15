# Workshop — starszy edytor pozycji pól

Opis wcześniejszego sposobu pracy na gotowych PDF-ach. Ograniczenia pól i dostępność tylko w developmentcie dotyczą tego rozwiązania. Obecny kreator: [[Workshop/kreator-szablonow]].

- Karty tego samego typu będą miały podobny układ.
- Wspólne pola, np. nazwa klanu, będą w tym samym miejscu na każdej karcie danego typu.
- Część pól, np. aspekty klanu, może mieć różne pozycje zależnie od wybranego szablonu.
- Pozycje pól będą zapisane osobno dla każdego szablonu.
- Potrzebny jest wygodny sposób ustalania i poprawiania pozycji pól.
- Pozycje pól ustawiamy w edytorze technicznym z podglądem szablonu i możliwością przeciągania pól.
- Edytor pozycji jest dostępny tylko podczas developmentu.
- Szablony PDF dodamy po uruchomieniu pustego projektu.

## Obsługa

- Kod starszego edytora pozycji nie trafia do buildu produkcyjnego.
- Dostępny tylko podczas developmentu i nieobecny w buildzie produkcyjnym.
- Wyświetla wybrany PDF jako tło.
- Pozwala dodawać, przesuwać i zmieniać rozmiar pól.
- Pozwala powiększać i pomniejszać podgląd PDF-u.
- Checkbox ma trzy predefiniowane rozmiary: mały `10×10`, duży `14×14` i bardzo duży `18×18`.
- Nowe pola mrocznego instynktu domyślnie używają bardzo dużego checkboxa `18×18`.
- Wielkość znaku `×` skaluje się razem z rozmiarem checkboxa.
- Każde pole zaznaczenia ma `markStyle`: `x` albo `v`.
- Domyślny styl wszystkich pól to `x`, poza talentami, które domyślnie używają `v`.
- Style korzystają z `app/src/assets/checked_x.svg` i `app/src/assets/checked_v.svg`.
- Checkbox nie ma ręcznej edycji szerokości ani wysokości.
- Nowy aspekt frakcji domyślnie używa małego checkboxa `10×10`.
- Obsługuje pola zaznaczenia oraz pola tekstowe.
- Każde pole ma nazwę, typ i pozycję na stronie PDF.
- Edytor pobiera wszystkie pliki PDF z `pdfTemplates/klany`.
- Konfiguracja leży obok PDF-u i ma taką samą nazwę bazową oraz rozszerzenie `.json`.
- Jeśli JSON istnieje, edytor go wczytuje i pozwala dalej edytować.
- Jeśli JSON nie istnieje, edytor zaczyna od pustej konfiguracji i tworzy go przy zapisie.
- WORKSHOP pozwala wybrać konfigurację kart klanów albo kart archetypów.
- Edytor archetypów pobiera wszystkie PDF-y z `pdfTemplates/archetypy`.
- JSON archetypu leży obok PDF-u i ma tę samą nazwę bazową.
- Karta archetypu ma na razie dwa pola tekstowe: „Imię lub przydomek” oraz „Nazwa klanu”.
- Można skopiować konfigurację podobnego szablonu i poprawić różniące się pozycje.
