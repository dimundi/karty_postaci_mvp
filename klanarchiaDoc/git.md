# Git

- `.gitignore` pomija zależności, build, cache TypeScript, logi i lokalne pliki `.env`.
- `app/package-lock.json` zapisujemy w repozytorium.
- `pdfTemplates` wraz z konfiguracjami JSON zapisujemy w repozytorium.
- Fonty, ich licencje i pozostałe źródłowe grafiki zapisujemy w repozytorium.
- Dokumentacja i wspólne ustawienia Obsidiana trafiają do repozytorium. Lokalne układy okien i cache są pomijane.
- `.gitattributes` ustawia LF dla tekstu i CRLF dla skryptów `.bat` oraz `.cmd`.
- PDF-y, fonty i grafiki rastrowe są oznaczone jako binarne. SVG pozostają tekstowe.

Po zmianie `.gitattributes` w istniejącym repozytorium można odświeżyć normalizację poleceniem `git add --renormalize .`. Przed commitem sprawdzamy diff.
