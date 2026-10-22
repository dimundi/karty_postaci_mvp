# Konfiguracja SMTP

- Plik do uzupełnienia: `privateData/smtp.json`.
- Szablon do repozytorium: `config/smtp.json.tmpl`, bez danych dostępowych.
- Cały katalog `privateData` jest wykluczony z Gita i montowany do lokalnego kontenera jako `/privateData`.
- W przeglądarce nie udostępniamy loginu ani hasła.

| Pole | Co wpisać |
| --- | --- |
| `host` | Adres serwera SMTP dostawcy poczty. |
| `port` | Port podany przez dostawcę, np. `587` dla STARTTLS lub `465` dla TLS od początku połączenia. |
| `encryption` | `starttls` albo `tls`, zgodnie z ustawieniami dostawcy. |
| `auth.user` | Login do serwera pocztowego. |
| `auth.pass` | Hasło SMTP. |
| `from.name` | Nazwa nadawcy widoczna w wiadomości. |
| `from.email` | Adres nadawcy. |
| `bcc` | Nasz adres ukrytej kopii. Odbiorca nagrody go nie widzi. |

Adres głównego odbiorcy pobieramy z [[Workshop/lista-mailingowa]], nie z konfiguracji SMTP.

Przy pierwszej konfiguracji plik można odtworzyć ze wzoru:

```powershell
Copy-Item config/smtp.json.tmpl privateData/smtp.json
```

Konfiguracja jest odczytywana przy wysyłce. `tls` włącza TLS od początku, `starttls` wymaga przejścia na TLS. Nie wyłączamy sprawdzania certyfikatu. Uzupełnienie pliku nie wysyła wiadomości.

Wysyłkę uruchamia wyłącznie „Wyślij” obok „Przygotuj podgląd” w podglądzie. Wymagany jest poprawny adres BCC. Jeśli zmienisz BCC po wygenerowaniu podglądu, wygeneruj podgląd ponownie.
