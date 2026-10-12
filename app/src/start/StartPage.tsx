import klanarchiaLogo from "../assets/klanarchia_logo.webp";
import publisherLogo from "../assets/WTF_logo_zlote.webp";

type StartPageProps = {
    development: boolean;
};

export default function StartPage({ development }: StartPageProps) {
    return (
        <main className="start-page">
            <div className="start-backdrop" />
            <section className="start-content">
                <div className="start-title">
                    <span className="start-kicker">Edytor kart postaci</span>
                    <h1>
                        <img src={klanarchiaLogo} alt="Klanarchia" />
                    </h1>
                    <p>Przygotuj bohaterów do walki z Ciemnością.</p>
                </div>

                <div className="start-actions">
                    <a className="start-action primary" href="#user">
                        <span>Wypełnij kartę od zera</span>
                        <small>Wybierz klan i przygotuj nową postać</small>
                    </a>

                    <button className="start-action" disabled>
                        <span>Wybierz predefiniowaną postać</span>
                        <small>W przygotowaniu</small>
                    </button>

                    <button className="start-action" disabled>
                        <span>Wczytaj zapisany JSON</span>
                        <small>W przygotowaniu</small>
                    </button>
                </div>

                {development ? (
                    <a className="developer-switch" href="#dev">
                        Przełącz na tryb deweloperski
                    </a>
                ) : null}

                <footer className="start-publisher">
                    <span>Wydawca</span>
                    <img src={publisherLogo} alt="What The Frog" />
                </footer>
            </section>
        </main>
    );
}
