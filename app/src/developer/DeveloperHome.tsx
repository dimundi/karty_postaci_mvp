export default function DeveloperHome() {
  return (
    <main className="developer-home">
      <a className="back-to-start" href="#">← Strona startowa</a>
      <div className="developer-home-content">
        <span>Tryb deweloperski</span>
        <h1>Konfiguracja szablonów</h1>
        <div className="developer-options">
          <a href="#dev-clans">
            <strong>Karty klanów</strong>
            <small>Aspekty, żar, talenty, mroczny instynkt i dary ciemności</small>
          </a>
          <a href="#dev-archetypes">
            <strong>Karty archetypów</strong>
            <small>Imię lub przydomek oraz nazwa klanu</small>
          </a>
        </div>
      </div>
    </main>
  )
}
