export default function DeveloperHome() {
  return (
    <main className="developer-home">
      <a className="back-to-start" href="#">← Strona startowa</a>
      <div className="developer-home-content">
        <span>Tryb deweloperski</span>
        <h1>Konfiguracja szablonów</h1>
        <div className="developer-options">
          <a href="#dev-templates">
            <strong>Kreator szablonów</strong>
            <small>Projekty, warianty, warstwy i pola kart</small>
          </a>
        </div>
      </div>
    </main>
  )
}
