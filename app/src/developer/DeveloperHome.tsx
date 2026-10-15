export default function DeveloperHome() {
  return (
    <main className="developer-home">
      <a className="back-to-start" href="#">← Strona startowa</a>
      <div className="developer-home-content">
        <span>WORKSHOP</span>
        <h1>Materiały do Klanarchii</h1>
        <div className="developer-options">
          <a href="#dev-templates">
            <strong>Kreator szablonów</strong>
            <small>Projekty, warianty, warstwy i pola kart</small>
          </a>
          <a href="#dev-talent-templates">
            <strong>Kreator szablonów talentów</strong>
            <small>Wygląd kart talentów i podgląd danych</small>
          </a>
          <a href="#dev-talents">
            <strong>Przegląd i import talentów</strong>
            <small>Wewnętrzna lista, edycja tekstowa i import XLS</small>
          </a>
          <div className="developer-option-disabled" aria-disabled="true">
            <strong>Edytor talentów</strong>
            <small>Tworzenie talentów i własnych list do PDF · W przygotowaniu</small>
          </div>
        </div>
      </div>
    </main>
  )
}
