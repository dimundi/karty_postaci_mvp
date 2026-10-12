import { useEffect, useMemo, useRef, useState } from "react";
import { getDocument, GlobalWorkerOptions, PDFDocumentLoadingTask } from "pdfjs-dist";
import UserArchetypeEditor, { ArchetypeConfig } from "./UserArchetypeEditor";
import { exportCharacterPdf } from "./exportCharacterPdf";
import checkedV from "../assets/checked_v.svg";
import checkedX from "../assets/checked_x.svg";
import { clanLogoUrl, templateUrl } from "../config";

GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function initialZoom() {
    if (window.innerWidth <= 520) return 0.5;
    if (window.innerWidth <= 900) return 0.75;
    return 1;
}

type FieldType = "factionAspect" | "heat" | "talent" | "darkInstinct" | "darkGift";
type MarkStyle = "x" | "v";

type TemplateField = {
    id: string;
    type: FieldType;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    parentId?: string;
    fontSize?: number;
    order?: number;
    markStyle?: MarkStyle;
};

type ClanTemplateConfig = {
    version: number;
    templateFile: string;
    clanId?: string;
    logoFile?: string;
    clanName: string;
    coordinateOrigin: "top-left";
    fields: TemplateField[];
};

type TemplateInfo = {
    fileName: string;
    hasConfig: boolean;
    clanName?: string;
    clanId?: string;
    logoFile?: string;
    archetypeName?: string;
};

type CounterType = "heat" | "darkInstinct";

type UserHistoryState = {
    userStep?: "clan" | "archetype";
    clanFile?: string;
    archetypeFile?: string;
};

export default function UserClanEditor() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const textAreaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
    const [clanTemplates, setClanTemplates] = useState<TemplateInfo[]>([]);
    const [archetypeTemplates, setArchetypeTemplates] = useState<TemplateInfo[]>([]);
    const [selectedFile, setSelectedFile] = useState("");
    const [pendingClanFile, setPendingClanFile] = useState("");
    const [selectedArchetypeFile, setSelectedArchetypeFile] = useState("");
    const [editingArchetype, setEditingArchetype] = useState(false);
    const [characterName, setCharacterName] = useState("");
    const [userClanName, setUserClanName] = useState("");
    const [config, setConfig] = useState<ClanTemplateConfig | null>(null);
    const [checkedFields, setCheckedFields] = useState<Record<string, boolean>>({});
    const [counters, setCounters] = useState<Record<CounterType, number>>({ heat: 0, darkInstinct: 0 });
    const [texts, setTexts] = useState<Record<string, string>>({});
    const [zoom, setZoom] = useState(initialZoom);
    const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
    const [message, setMessage] = useState("Wczytywanie kart klanu…");

    const configuredTemplates = useMemo(() => clanTemplates.filter((template) => template.hasConfig), [clanTemplates]);

    const fieldsByType = useMemo(() => {
        const fields = config?.fields ?? [];

        return {
            factionAspect: fields.filter((field) => field.type === "factionAspect"),
            heat: fields.filter((field) => field.type === "heat").sort(byOrder),
            talent: fields.filter((field) => field.type === "talent"),
            darkInstinct: fields.filter((field) => field.type === "darkInstinct").sort(byOrder),
            darkGift: fields.filter((field) => field.type === "darkGift"),
        };
    }, [config]);

    useEffect(() => {
        void Promise.all([
            fetch(templateUrl("klany/index.json")).then((response) => response.json() as Promise<TemplateInfo[]>),
            fetch(templateUrl("archetypy/index.json")).then((response) => response.json() as Promise<TemplateInfo[]>),
        ])
            .then(([loadedClanTemplates, loadedArchetypeTemplates]) => {
                setClanTemplates(loadedClanTemplates);
                setArchetypeTemplates(loadedArchetypeTemplates);
                if (loadedClanTemplates.some((template) => template.hasConfig)) {
                    setMessage("");
                } else {
                    setMessage("Brak skonfigurowanych kart klanu. Zapisz najpierw JSON w edytorze technicznym.");
                }
            })
            .catch(() => setMessage("Nie udało się pobrać listy kart klanu."));
    }, []);

    useEffect(() => {
        if (!selectedFile) {
            return;
        }

        setMessage("Wczytywanie karty…");
        setCheckedFields({});
        setCounters({ heat: 0, darkInstinct: 0 });
        setTexts({});

        void fetch(templateUrl(`klany/${encodeURIComponent(selectedFile.replace(/\.pdf$/i, ".json"))}`))
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Brak konfiguracji karty.");
                }
                return response.json() as Promise<ClanTemplateConfig>;
            })
            .then((loadedConfig) => {
                setConfig(loadedConfig);
                setUserClanName(loadedConfig.clanName);
                setMessage("");
            })
            .catch((error: Error) => setMessage(error.message));
    }, [selectedFile]);

    useEffect(() => {
        const handleHistoryChange = (event: PopStateEvent) => {
            const state = event.state as UserHistoryState | null;

            if (state?.userStep === "archetype" && state.clanFile && state.archetypeFile) {
                setSelectedFile(state.clanFile);
                setSelectedArchetypeFile(state.archetypeFile);
                setEditingArchetype(true);
                return;
            }

            if (state?.userStep === "clan" && state.clanFile) {
                setSelectedFile(state.clanFile);
                if (state.archetypeFile) setSelectedArchetypeFile(state.archetypeFile);
                setEditingArchetype(false);
                return;
            }

            setEditingArchetype(false);
            setSelectedFile("");
        };

        window.addEventListener("popstate", handleHistoryChange);
        return () => window.removeEventListener("popstate", handleHistoryChange);
    }, []);

    useEffect(() => {
        if (!selectedFile || !canvasRef.current) {
            return;
        }

        let loadingTask: PDFDocumentLoadingTask | null = getDocument({
            url: templateUrl(`klany/${encodeURIComponent(selectedFile)}`),
        });
        let cancelled = false;

        void loadingTask.promise
            .then(async (document) => {
                const page = await document.getPage(1);
                const sourceViewport = page.getViewport({ scale: 1 });
                const viewport = page.getViewport({ scale: zoom });
                const canvas = canvasRef.current;

                if (!canvas || cancelled) {
                    return;
                }

                const pixelRatio = window.devicePixelRatio || 1;
                const context = canvas.getContext("2d");

                if (!context) {
                    return;
                }

                canvas.width = Math.floor(viewport.width * pixelRatio);
                canvas.height = Math.floor(viewport.height * pixelRatio);
                canvas.style.width = `${viewport.width}px`;
                canvas.style.height = `${viewport.height}px`;
                setPageSize({ width: sourceViewport.width, height: sourceViewport.height });

                await page.render({
                    canvas,
                    canvasContext: context,
                    viewport,
                    transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
                }).promise;
            })
            .catch(() => setMessage("Nie udało się wyświetlić PDF-u."));

        return () => {
            cancelled = true;
            void loadingTask?.destroy();
            loadingTask = null;
        };
    }, [selectedFile, zoom]);

    function toggleField(fieldId: string) {
        setCheckedFields((current) => ({ ...current, [fieldId]: !current[fieldId] }));
    }

    function setCounter(type: CounterType, value: number) {
        setCounters((current) => ({ ...current, [type]: value }));
    }

    function clickOverlay(field: TemplateField) {
        if (field.type === "factionAspect" || field.type === "talent") {
            toggleField(field.id);
            return;
        }

        if (field.type === "heat" || field.type === "darkInstinct") {
            const order = field.order ?? 1;
            setCounter(field.type, counters[field.type] === order ? order - 1 : order);
            return;
        }

        textAreaRefs.current[field.id]?.focus();
    }

    function isFieldChecked(field: TemplateField) {
        if (field.type === "heat" || field.type === "darkInstinct") {
            return (field.order ?? 1) <= counters[field.type];
        }

        return Boolean(checkedFields[field.id]);
    }

    function changeZoom(direction: -1 | 1) {
        const index = ZOOM_LEVELS.indexOf(zoom);
        const nextIndex = Math.min(ZOOM_LEVELS.length - 1, Math.max(0, index + direction));
        setZoom(ZOOM_LEVELS[nextIndex]);
    }

    function openClanEditor() {
        setSelectedFile(pendingClanFile);
        setEditingArchetype(false);
        window.history.pushState(
            {
                userStep: "clan",
                clanFile: pendingClanFile,
                archetypeFile: selectedArchetypeFile,
            } satisfies UserHistoryState,
            "",
            "#user",
        );
    }

    function changeClan(fileName: string) {
        setSelectedFile(fileName);
        setPendingClanFile(fileName);
        window.history.replaceState(
            {
                userStep: "clan",
                clanFile: fileName,
                archetypeFile: selectedArchetypeFile,
            } satisfies UserHistoryState,
            "",
            "#user",
        );
    }

    function openArchetypeEditor() {
        setEditingArchetype(true);
        window.history.pushState(
            {
                userStep: "archetype",
                clanFile: selectedFile,
                archetypeFile: selectedArchetypeFile,
            } satisfies UserHistoryState,
            "",
            "#user",
        );
    }

    async function exportPdf(archetypeConfig: ArchetypeConfig) {
        if (!config) return;

        await exportCharacterPdf({
            clan: {
                templateFile: selectedFile,
                fields: config.fields,
                checkedFields,
                counters,
                texts,
            },
            archetype: {
                templateFile: selectedArchetypeFile,
                fields: archetypeConfig.fields,
                characterName,
                clanName: userClanName,
            },
        });
    }

    if (editingArchetype && selectedArchetypeFile && config) {
        return (
            <UserArchetypeEditor
                archetypeFile={selectedArchetypeFile}
                clanName={userClanName}
                onClanNameChange={setUserClanName}
                characterName={characterName}
                onCharacterNameChange={setCharacterName}
                onBack={() => window.history.back()}
                onExport={exportPdf}
            />
        );
    }

    if (!selectedFile) {
        return (
            <main className="clan-selection-page">
                <header className="selection-header">
                    <a className="back-to-start" href="#">
                        ← Strona startowa
                    </a>
                    <h1>Skonfiguruj pierwszą postać</h1>
                    {message ? <p>{message}</p> : null}
                </header>

                <section className="clan-selection" aria-label="Karty klanów">
                    <div className="clan-card-list">
                        {clanTemplates.map((template, index) => (
                            <button
                                key={template.fileName}
                                className={pendingClanFile === template.fileName ? "clan-choice selected" : "clan-choice"}
                                disabled={!template.hasConfig}
                                onClick={() => setPendingClanFile(template.fileName)}
                            >
                                {template.logoFile ? (
                                    <img
                                        className="clan-choice-logo"
                                        src={clanLogoUrl(template.logoFile)}
                                        alt=""
                                    />
                                ) : (
                                    <span className="clan-choice-number">{String(index + 1).padStart(2, "0")}</span>
                                )}
                                <strong>{template.clanName || `Karta klanu ${index + 1}`}</strong>
                                {!template.hasConfig ? <small>Brak konfiguracji</small> : null}
                            </button>
                        ))}
                    </div>
                </section>

                <section className="archetype-selection" aria-labelledby="archetype-selection-title">
                    <div className="selection-subheader">
                        <h2 id="archetype-selection-title">Wybierz kartę archetypu</h2>
                    </div>
                    <div className="archetype-card-list">
                        {archetypeTemplates.map((template, index) => (
                            <button
                                key={template.fileName}
                                className={selectedArchetypeFile === template.fileName ? "archetype-choice selected" : "archetype-choice"}
                                disabled={!template.hasConfig}
                                onClick={() => setSelectedArchetypeFile(template.fileName)}
                            >
                                <span>{String(index + 1).padStart(2, "0")}</span>
                                <strong>{template.archetypeName || `Archetyp ${index + 1}`}</strong>
                                <small>{template.hasConfig ? "Wybierz kartę" : "Brak konfiguracji"}</small>
                            </button>
                        ))}
                    </div>
                </section>

                <div className="selection-footer">
                    <button disabled={!pendingClanFile || !selectedArchetypeFile} onClick={openClanEditor}>
                        Dalej
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="user-editor">
            <header className="user-header">
                <div>
                    <a className="back-to-start" href="#">
                        ← Strona startowa
                    </a>
                    <h1>Karta klanu</h1>
                    <p>{config?.clanName || message}</p>
                </div>
                <div className="user-header-actions">
                    <button className="next-step-button" onClick={openArchetypeEditor}>
                        <span>Następny krok</span>
                        <strong>Edytuj archetyp →</strong>
                    </button>
                </div>
            </header>

            <div className="user-layout">
                <aside className="character-form">
                    <label className="clan-select">
                        Klan
                        <select value={selectedFile} onChange={(event) => changeClan(event.target.value)}>
                            {configuredTemplates.map((template) => (
                                <option key={template.fileName} value={template.fileName}>
                                    {template.clanName || template.fileName}
                                </option>
                            ))}
                        </select>
                    </label>

                    {fieldsByType.factionAspect.length > 0 ? (
                        <FieldGroup
                            title="Aspekty frakcji"
                            fields={fieldsByType.factionAspect}
                            checkedFields={checkedFields}
                            onToggle={toggleField}
                        />
                    ) : null}

                    {fieldsByType.talent.length > 0 ? (
                        <FieldGroup title="Talenty" fields={fieldsByType.talent} checkedFields={checkedFields} onToggle={toggleField} />
                    ) : null}

                    {fieldsByType.heat.length > 0 ? (
                        <Counter
                            title="Początkowa wartość Żaru"
                            maximum={Math.min(3, fieldsByType.heat.length)}
                            value={counters.heat}
                            onChange={(value) => setCounter("heat", value)}
                        />
                    ) : null}

                    {fieldsByType.darkInstinct.length > 0 ? (
                        <Counter
                            title="Mroczny instynkt"
                            maximum={Math.min(3, fieldsByType.darkInstinct.length)}
                            value={counters.darkInstinct}
                            onChange={(value) => setCounter("darkInstinct", value)}
                        />
                    ) : null}

                    {fieldsByType.darkGift.map((field) => (
                        <label className="dark-gift-input" key={field.id}>
                            {field.label}
                            <textarea
                                ref={(element) => {
                                    textAreaRefs.current[field.id] = element;
                                }}
                                value={texts[field.id] ?? ""}
                                onChange={(event) => setTexts((current) => ({ ...current, [field.id]: event.target.value }))}
                            />
                        </label>
                    ))}
                </aside>

                <section className="user-preview">
                    <div className="preview-toolbar">
                        <div className="user-zoom" aria-label="Powiększenie podglądu PDF">
                            <button onClick={() => changeZoom(-1)} disabled={zoom === ZOOM_LEVELS[0]}>
                                −
                            </button>
                            <select value={zoom} onChange={(event) => setZoom(Number(event.target.value))}>
                                {ZOOM_LEVELS.map((level) => (
                                    <option key={level} value={level}>
                                        {level * 100}%
                                    </option>
                                ))}
                            </select>
                            <button onClick={() => changeZoom(1)} disabled={zoom === ZOOM_LEVELS.at(-1)}>
                                +
                            </button>
                        </div>
                    </div>
                    {message ? <div className="user-message">{message}</div> : null}
                    <div className="user-pdf-page" style={{ width: pageSize.width * zoom, height: pageSize.height * zoom }}>
                        <canvas ref={canvasRef} />
                        {config?.fields.map((field) => (
                            <button
                                key={field.id}
                                className={`user-overlay ${field.type === "darkGift" ? "user-text-overlay" : "user-check-overlay"}`}
                                style={{
                                    left: field.x * zoom,
                                    top: field.y * zoom,
                                    width: field.width * zoom,
                                    height: field.height * zoom,
                                    fontSize: (field.type === "darkGift"
                                        ? field.fontSize ?? 10
                                        : Math.max(field.fontSize ?? 10, field.height * 0.9)) * zoom,
                                }}
                                title={field.label}
                                onClick={() => clickOverlay(field)}
                            >
                                {field.type === "darkGift" ? texts[field.id] : isFieldChecked(field) ? (
                                    <img
                                        className="user-marker"
                                        src={(field.markStyle ?? (field.type === "talent" ? "v" : "x")) === "v" ? checkedV : checkedX}
                                        alt=""
                                    />
                                ) : ""}
                            </button>
                        ))}
                    </div>
                </section>
            </div>
            <div className="mobile-next-step">
                <button className="next-step-button" onClick={openArchetypeEditor}>
                    <span>Następny krok</span>
                    <strong>Edytuj archetyp →</strong>
                </button>
            </div>
        </main>
    );
}

function byOrder(first: TemplateField, second: TemplateField) {
    return (first.order ?? 0) - (second.order ?? 0);
}

function FieldGroup({
    title,
    fields,
    checkedFields,
    onToggle,
}: {
    title: string;
    fields: TemplateField[];
    checkedFields: Record<string, boolean>;
    onToggle: (fieldId: string) => void;
}) {
    return (
        <details className="form-section collapsible-section" open>
            <summary>{title}</summary>
            <div className="collapsible-content">
                {fields.map((field) => (
                    <label className="form-checkbox" key={field.id}>
                        <input type="checkbox" checked={Boolean(checkedFields[field.id])} onChange={() => onToggle(field.id)} />
                        <span>{field.label}</span>
                    </label>
                ))}
            </div>
        </details>
    );
}

function Counter({ title, maximum, value, onChange }: { title: string; maximum: number; value: number; onChange: (value: number) => void }) {
    return (
        <fieldset className="form-section">
            <legend>{title}</legend>
            <div className="counter-buttons">
                {Array.from({ length: maximum + 1 }, (_, valueOption) => (
                    <button key={valueOption} className={value === valueOption ? "active" : ""} onClick={() => onChange(valueOption)}>
                        {valueOption}
                    </button>
                ))}
            </div>
        </fieldset>
    );
}
