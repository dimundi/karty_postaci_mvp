# Workshop — Talenty ekskluzywne

Moduł Workshop do zarządzania zbiorem talentów dostępnych tylko dla określonych osób.

## Ustalenia

- Talenty ekskluzywne mogą być wygrywane przez użytkowników.
- Dostęp do nich mają tylko osoby, którym zostały przyznane.
- Na początek otrzymają je wszyscy, którzy wsparli projekt na Gamefound.

## Do ustalenia

- Czy jeden talent może być przypisany do wielu adresów e-mail, czy każdy adres otrzymuje osobny talent.
- Jak obsługujemy nieudaną wysyłkę dla istniejącego powiązania.
- Jak moduł łączy się z [[Workshop/edytor-talentow|Edytorem talentów Workshop]].
- Jak moduł korzysta ze wspólnej listy zarządzanej w [[Workshop/przeglad-i-import-talentow]].

## Listy i powiązania

- Prowadzimy osobną listę talentów i osobną listę adresów e-mail.
- Dla adresu bez powiązania wybieramy pierwszy dowolny talent i zapisujemy powiązanie talentu z adresem.
- Zapisane powiązanie pozwala sprawdzić, jaki talent otrzymał dany adres.

## Pliki i dostęp

- Na obecnym etapie pracujemy wyłącznie na plikach, bez bazy danych. Priorytetem jest szybkie przygotowanie działającego narzędzia.
- Wewnętrzną listę talentów przechowujemy w JSON-ie. Na niej pracuje edytor Workshop.
- XLS jest osobnym źródłem importu, a nie plikiem edytowanym bezpośrednio przez edytor.
- Import pokazuje podgląd danych. Dopiero zatwierdzenie zmienia wewnętrzną listę.
- Plik XLS może być edytowany przez osoby trzecie.
- Adresy e-mail przechowujemy w osobnym pliku, dostępnym tylko dla nas.
- Do XLS-a z talentami nie wpisujemy adresów e-mail.

## Struktura JSON talentu

Wewnętrzny plik: `cardTemplates/talenty/talenty.json`. Poniżej obowiązująca struktura z jednym wspólnym szablonem HTML.

```json
{
  "schemaVersion": 1,
  "talents": [
    {
      "id": "talent-0001",
      "name": "Nazwa talentu",
      "flavorDescription": "Opis fabularny talentu.",
      "description": "Opis działania talentu.",
      "usesPerMission": 3,
      "isDarkGift": true,
      "group": "Dary Ciemności",
      "subgroup": null,
      "code": null
    }
  ]
}
```

Przykładowe teksty nie definiują nowego talentu ani zasad gry.

| Pole | Znaczenie |
| --- | --- |
| `schemaVersion` | Wersja struktury pliku; początkowo `1`. |
| `talents` | Wewnętrzna lista talentów. |
| `id` | Stały, unikalny identyfikator wewnętrzny nadawany przy utworzeniu rekordu, również podczas pierwszego importu. Niezależny od nazwy i kodu wysyłkowego. |
| `name` | Nazwa talentu. |
| `flavorDescription` | Opis fabularny. Pusty tekst, jeśli go brak. |
| `description` | Opis działania talentu. |
| `usesPerMission` | Liczba całkowita od `0` do `3`, odpowiadająca liczbie kwadratów na karcie. |
| `isDarkGift` | Flaga logiczna. `true` oznacza Dar Ciemności i włącza jego ikonę w HTML; `false` wyłącza ikonę. Niezależna od grupy i podgrupy. |
| `group` | Grupa do zarządzania talentami. Dla obecnego zbioru: `Dary Ciemności`. |
| `subgroup` | Podgrupa do zarządzania talentami. Dla obecnego zbioru: `null`, czyli brak podgrupy. |
| `code` | Kod nadawany przy wysyłce, zgodny z opisanym niżej formatem. Wcześniej `null`. |

- Grupa i podgrupa służą wyłącznie do zarządzania talentami. Nie są zasadami gry ani treścią talentu w wiadomości i PDF-ie.
- Wszystkie talenty korzystają z jednego [[Workshop/kreator-szablonow-talentow|szablonu HTML]], który interpretuje ich parametry. Nie używamy pola `templateTypeId`.
- Kolejne opcje i flagi dopiszemy po ustaleniu ich znaczenia. Nie wyprowadzamy ich z nazwy grupy.
- XLS nadal ma pięć ustalonych kolumn. Grupę `Dary Ciemności` i brak podgrupy ustawiamy przy imporcie tego zbioru.
- XLS nie ma kolumny `isDarkGift`. Import zachowuje flagę istniejącego talentu; nowy talent otrzymuje `false`. Flagę ustawiamy osobno w edytorze, nie na podstawie grupy.
- Kolumna „Kod” odpowiada polu `code`. Nie zastępuje wewnętrznego `id`.
- Adresy e-mail, powiązania odbiorców i statusy wysyłki zapisujemy osobno, poza JSON-em talentów.

## Kolumny XLS

Plik zawiera dokładnie pięć kolumn, w tej kolejności:

| Kolumna | Zawartość |
| --- | --- |
| Nazwa talentu | Nazwa talentu. |
| Opis fabularny talentu | Tekst fabularny. |
| Opis talentu | Opis działania talentu. |
| Ile razy można użyć | Liczba użyć na misję: liczba całkowita od 0 do 3. |
| Kod | Unikalny identyfikator, początkowo pusty; nadawany automatycznie przez narzędzie przy wysyłce. |

## Import z PDF

- Plik `talenty_dary_ciemnosci.xls` w głównym katalogu projektu zawiera 19 talentów z `Talenty_dary ciemnosci.pdf`.
- Liczba użyć to liczba kwadratów na karcie. Brak kwadratów oznacza 0 w tej kolumnie.
- Cyfra przy symbolu strzałki nie jest liczbą użyć.
- Opis fabularny wyodrębniamy z tekstu zapisanego kursywą. Jeśli go nie ma, komórka pozostaje pusta.
- Pomijamy wzorcową stronę „Cyrograf”, zawierającą tekst zastępczy.
- Kolumna „Kod” pozostaje pusta do wysyłki.

## Identyfikator talentu

- Każdy talent otrzymuje unikalny identyfikator w momencie wysłania.
- Identyfikator zapisujemy w przeznaczonej do tego kolumnie XLS-a przy talencie.
- Ten sam identyfikator zapisujemy przy adresie e-mail w naszym osobnym pliku.
- Identyfikator łączy oba pliki bez udostępniania adresu e-mail osobom edytującym XLS.
- Format: `XXXX-XXXX` — 8 znaków identyfikatora, rozdzielonych myślnikiem po czwartym znaku; łącznie 9 znaków zapisu.
- Dozwolone są wyłącznie wielkie litery łacińskie `A–Z` bez `O` i `I` oraz cyfry `2–9`. Nie używamy cyfr `0` i `1`.
- Przykład formatu: `A7K2-M9B4`.
- Narzędzie sprawdza unikalność identyfikatora w obu plikach przed jego przypisaniem.

## Wysyłka

- Wysyłkę uruchamiamy przyciskiem w Workshop.
- E-maile wysyłamy z kontenera uruchomionego lokalnie na localhost.
- Wiadomość trafia na adres powiązany z talentem.
- Treść wiadomości zawiera estetycznie wyrenderowany talent.
- Do wiadomości dołączamy PDF z tym talentem.
- Po dodaniu nowych adresów obsługujemy tylko te, które nie mają jeszcze powiązania z talentem.
- Adresy z istniejącym powiązaniem pomijamy: nie przypisujemy im ponownie talentu i nie wysyłamy kolejnej wiadomości w tym przebiegu.

Powiązane: [[start]], [[Portal/edytor-talentow]].
