# Workshop — Lista mailingowa

Adres: [Lista mailingowa](http://localhost:8080/#dev-mailing-list). Wejście z ekranu Workshop.

## Obecny zakres

- 2026-10-22: przed ponownym importem usunięto 122 wpisy. Zachowano bez zmian dwa wpisy o numerach 900 i 901. Kopia: `privateData/mailing-list.json.before-list-refresh-20261022-151548.bak`.

- Ręczne dodawanie pojedynczego adresu e-mail.
- Ręcznie dodany adres otrzymuje `orderId: TEST` i wolny numer po największym zapisanym numerze, co najmniej 900. Nie podbija numeracji importu.
- Lista pokazuje numer kolejny i zamówienie. Najpierw wyświetla numery od 900, potem pozostałe. W obu grupach numery rosną; wpisy bez numeru są na końcu.
- „Edytuj” pozwala zmienić adres e-mail. Numer, zamówienie, UUID i pozostałe dane zostają zachowane. Walidacja blokuje powtórzony adres i zapis po równoczesnej zmianie adresu. Dla statusów `sending` i `sent` edycja jest zablokowana.
- Przegląd listy, wyszukiwanie po fragmencie adresu i data dodania.
- Przy adresie pokazujemy status wysyłki, ID przypisanego talentu, kod nagrody i przycisk „Wyślij”. Przypisanie i kod są widoczne także po błędzie.
- Statusy: `not_sent` (Nie wysłano), `sending` (Wysyłanie), `sent` (Wysłano), `error` (Błąd wysyłki). Przycisk jest zablokowany dla trwającej i zakończonej wysyłki.
- „Wyślij” otwiera osobny widok podglądu dla odbiorcy. „Wróć do listy” zachowuje wyszukiwanie, pozycję przewinięcia i fokus przy wybranym adresie.
- Plik do uzupełnienia i opis pól: [[Workshop/konfiguracja-smtp]]. Samo uzupełnienie pliku nie uruchamia jeszcze wysyłki.
- Walidacja adresu po stronie formularza i serwera.
- Pomijamy zewnętrzne spacje i normalizujemy wielkość liter. Powtórzony adres powoduje komunikat, bez dodawania kolejnego wpisu.
- „Przeglądaj” otwiera wybór CSV. „Pokaż podgląd importu” przesyła plik do lokalnego API i pokazuje nowe wpisy, pominięcia, błędy oraz proponowane numery. Dopiero „Zatwierdź import” zapisuje nowe wpisy. Szczegóły: [[Workshop/import-maili]].
- Moduł wysyła wiadomość dopiero po potwierdzeniu podglądu. Przed SMTP zapisuje przypisanie, kod i status `sending`; po akceptacji dla odbiorcy zapisuje `sent`.

## Import CSV

- Plik wzorcowy: `klanarchiaDoc/Workshop/emails/Aetherworks.csv`. Docelowo wybieramy plik z interfejsu.
- Kolumna `order` (pierwsza w pliku) trafia do `orderId`. Zachowujemy ją jako tekst.
- Adres pobieramy z kolumny `email`.
- Każdy nowy wpis otrzymuje trwały numer kolejny. Pierwszy rekord danych w pierwszym imporcie ma numer 1; nagłówek nie jest rekordem.
- Zachowujemy kolejność rekordów z pliku. Kolejne importy kontynuują numerację po największym numerze wpisu nietestowego. Wpisy z `orderId: TEST` są poza numeracją importu.
- Istniejących wpisów nie dodajemy ponownie i nie zmieniamy ich numerów. Pominięte wpisy nie zużywają nowych numerów.
- Para `orderId` + `email` identyfikuje wpis. Parę już zapisaną pomijamy przy kolejnym imporcie.
- Sprawdzamy również powtórzenia samego adresu i samego zamówienia. Ten sam e-mail przy innym `orderId` lub ten sam `orderId` przy innym e-mailu oznacza błąd. Wyjątek: `orderId: TEST` może się powtarzać; e-maile nadal muszą być unikalne.
- Kontrola obejmuje importowany plik i dane już zapisane.
- Procedura i analiza pliku: [[Workshop/import-maili]].
- Import jest dostępny w UI. Dwóm istniejącym wpisom ręcznym nadano `sequenceNumber: 900` i `901` oraz `orderId: TEST`.

## Podgląd nagrody

- Przy statusie „Wysłano” przycisk „Zobacz materiały” otwiera zapisaną grafikę i PDF, z linkami do otwarcia plików w nowych kartach. Używa `draftId` przypisanego odbiorcy i plików z wysyłki. Nie generuje ich ponownie i nie uruchamia SMTP. Powrót zachowuje filtr oraz pozycję listy.

- „Kolejny” w nagłówku pobiera aktualną listę i otwiera odbiorcę o `sequenceNumber` dokładnie większym o 1. Chodzi o widoczny numer, nie UUID ani kolejność sortowania listy. Automatycznie przygotowuje podgląd z pierwszym wolnym talentem. Nie wysyła wiadomości. Brak numeru lub status `sent`/`sending` zatrzymuje przejście z komunikatem; nie przeskakujemy do dalszego numeru. Odbiorca z wcześniej przypisaną nagrodą zachowuje swój talent i kod.

- Informacja o puli i wybór talentu są w zwartym pasku. Na szerokim ekranie mail i grafika są obok siebie; na telefonie jeden pod drugim.
- Lista i podgląd mają własne przewijanie na wysokości okna. Powrót odtwarza pozycję w tym obszarze, niezależnie od globalnych stylów edytora.

- Pula podglądu wysyłki jest stała: wyłącznie grupa `Dary Ciemności` i podgrupa `Ekskluzywne`. UI pokazuje pulę i liczbę wolnych talentów, bez wyboru innych grup. Ograniczenie jest również w API; podanie ID talentu z `Ogólne` lub innej grupy nie pozwala przygotować podglądu.
- Dawny plik wyboru `privateData/mailing-selection.json` nie steruje już pulą; nie usuwamy go automatycznie. Flaga `isDarkGift` nie zastępuje warunku grupy i podgrupy.
- Przy odbiorcy klikamy „Wyślij”, wybieramy konkretny wolny talent albo pierwszy wolny z podgrupy `Ekskluzywne`, następnie „Przygotuj podgląd”.
- Wolny talent nie ma kodu i nie występuje jako `talentId` przy żadnym odbiorcy, także ze statusem `error` lub `sending`.
- Podgląd pokazuje adres odbiorcy, BCC z konfiguracji, temat i treść maila, grafikę oraz link do PDF.
- Treść jest wspólna, zgodna z tekstem użytkownika, bez edycji w formularzu.
- Mail kończy się pożegnaniem „Do zobaczenia w świecie Klanarchii!” i podpisem „Zespół Klanarchii”.
- Pod podpisem jest stopka wydawnictwa What The Frog z linkiem `https://whatthefrog.pl`. Dane prawne pozostają danymi Dimundi Sp. z o.o. podanymi przez użytkownika: adres, telefon, NIP, REGON, KRS i sąd rejestrowy. Stopka zawiera też przekazane klauzule poufności PL/EN. Szablon: `app/scripts/mailing-email-footer.cjs`.
- Mail nie opisuje talentu ani jego mechaniki. Informuje o unikalnej nagrodzie, pokazuje kod i wyjaśnia jego użycie do karty postaci lub arkusza talentów w przyszłym edytorze. Powstanie edytora zależy od odblokowania celu zbiórki. Prosi też o udostępnienie załączonej grafiki w mediach społecznościowych.
- Temat: „Klanarchia — talent za wsparcie projektu”. Treść zaczyna się od „Dziękujemy za wsparcie Klanarchii!”. Zachęca do udostępnienia grafiki z hashtagiem `#Klanarchia`; informuje o celu społecznościowym po 50 udostępnieniach i edytorze talentów jako kolejnym celu zbiórki.
- Pogrubione są: informacja o wyłączności talentu, wezwanie do udostępnienia, hashtag i wprowadzenie kodu („Przesyłamy Ci również Twój unikalny kod:”). Kod jest dynamiczny, pokazany pogrubieniem w ozdobnej ramce; kod przykładowy z tekstu użytkownika nie jest wpisany na stałe. Nowa treść dotyczy nowo przygotowanych podglądów.
- Podgląd generuje rzeczywisty kod: 8 wielkich liter i cyfr, z myślnikiem po 4 znakach, bez O, I, 0 i 1. Kod zapisuje się w `message.json` jako `code` i w treści maila. Generator wyklucza kody istniejących podglądów i biblioteki. Grafika pozostaje osobnym załącznikiem.
- Materiały i kopia danych talentu oraz szablonu trafiają do `privateData/messages/<UUID>/`: `message.json`, `email.html`, `talent.pdf`, `facebook.png`. Kolejne podglądy tworzą osobne katalogi.
- Na `facebook.png` nad ramką talentu pokazujemy „Talent nr: …”, z minimum trzema cyframi: `001`, `012`, `901`, `1000`. Źródłem jest `sequenceNumber` odbiorcy z listy, nie ID talentu ani kod nagrody. Numer zapisujemy też w `message.json` jako `sequenceNumber` (liczba bez zer wiodących). Brak numeru blokuje przygotowanie podglądu. Zmiana dotyczy nowych podglądów; wcześniej zapisane grafiki wymagają ponownego przygotowania podglądu.
- Zapis podglądu nie rezerwuje talentu i nie zmienia statusu odbiorcy. Ten sam wolny talent może wystąpić w kilku podglądach.
- „Wyślij” obok „Przygotuj podgląd” wywołuje `POST /api/mailing-list/preview-send` z `draftId`. Wysyła zapisane `email.html`, `talent.pdf` i `facebook.png`, do odbiorcy z ukrytą kopią BCC. Nie generuje materiałów ponownie.
- Przed wysyłką serwer ponownie sprawdza dostępność talentu, unikalność kodu i zgodność treści talentu z podglądem. Stary podgląd nie pozwala wysłać już przydzielonego talentu innej osobie.
- Najpierw zapisuje w `privateData/mailing-list.json`: `talentId`, `code`, `draftId`, `deliveryStatus: sending`, `lastAttemptAt`. Lista jest trwałym rejestrem rezerwacji. Następnie zapisuje ten sam kod w `cardTemplates/talenty/talenty.json` przy talencie. Oba zapisy mają kopię `.bak` i podmianę przez `.tmp`. XLS pozostaje plikiem importu, bez zmian.
- Akceptacja SMTP musi obejmować głównego odbiorcę. Samo przyjęcie BCC nie oznacza sukcesu. Po sukcesie zapisujemy `deliveryStatus: sent`, `sentAt` i `messageId`; odrzucona kopia BCC jest sygnalizowana osobno przez `bccRejected`.
- Po błędzie zapisujemy `deliveryStatus: error` i bezpieczny komunikat `deliveryError`, zachowując talent i kod. Otwórz ponownie odbiorcę i kliknij „Przygotuj podgląd”: otrzymasz zapisane materiały, z tym samym kodem i talentem, również gdy nie ma już wolnych talentów. BCC musi zgadzać się z konfiguracją wykorzystaną do podglądu.
- `sent` i `sending` blokują ponowną wysyłkę również po restarcie. Awaria procesu lub zapisu statusu po akceptacji SMTP może pozostawić `sending`. Nie odblokowujemy go automatycznie: najpierw trzeba sprawdzić skrzynki i ustalić wynik wysyłki.
- Lista odświeża status po próbie wysyłki. Powrót do listy jest zablokowany na czas generowania i wysyłania. Adresu z przypisaną nagrodą nie można edytować.
- Sukces oznacza przyjęcie przez SMTP, nie potwierdzenie dostarczenia. Przy niejednoznacznym błędzie lub częściowej akceptacji sprawdzamy skrzynki przed powtórzeniem.
- Test bez rzeczywistej poczty: `docker compose exec app node scripts/verify-mailing-send.cjs`.
- Generowanie działa bez uzupełnionego SMTP. Hasło i login SMTP nie trafiają do przeglądarki ani podglądu.
- Test generowania: `docker compose exec app node scripts/verify-mailing-preview.cjs`. Pracuje na danych tymczasowych.

## Plik listy

- Prywatny plik: `privateData/mailing-list.json`.
- Cały katalog `privateData` jest pomijany przez Git. Jest montowany wyłącznie do lokalnego kontenera `app` pod `/privateData`.
- Plik nie znajduje się w katalogach statycznych i nie jest kopiowany do buildu Portalu.
- Odczyt i dopisanie adresu: lokalne API `/api/mailing-list`, dostępne w Workshop podczas developmentu.
- Przy zapisie powstaje kopia `.bak`. Nowy stan zapisujemy przez `.tmp`, następnie podmieniamy plik.
- Niepoprawny istniejący JSON blokuje dodawanie, zamiast zastępować listę pustą.

```json
{
  "schemaVersion": 1,
  "recipients": [
    {
      "id": "stały-identyfikator-uuid",
      "email": "odbiorca@example.com",
      "orderId": "przykladowe-zamowienie",
      "sequenceNumber": 1,
      "createdAt": "2026-10-19T12:00:00.000Z",
      "deliveryStatus": "not_sent",
      "talentId": null
    }
  ]
}
```

Przykład jest wyłącznie opisem struktury. Nie dodajemy przykładowych adresów do rzeczywistej listy.

`id` identyfikuje odbiorcę. `talentId` wskazuje przypisany talent, `code` zawiera kod nagrody, a `draftId` wskazuje katalog zapisanych materiałów. Starsze wpisy bez statusu i przypisania są odczytywane jako `not_sent` i `talentId: null`.

Po dodaniu montowania katalogu uruchamiamy `docker compose up -d --force-recreate app`. Wolumenu `node_modules` nie trzeba odnawiać.

Test: `docker compose exec app node scripts/verify-mailing-list.cjs`. Korzysta z osobnego, tymczasowego JSON-a.
