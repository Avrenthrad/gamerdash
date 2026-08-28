// TCG collection CSV import — ManaBox, Collectr, or a generic CSV
// export. File upload only, no OAuth into those apps. See
// lib/csvImport.js for the parsing/matching logic — this component is
// just the pick source -> upload -> review -> commit flow.

import { useState } from "react";
import { parseCsv, mapCsvRow, resolveCsvRows } from "../lib/csvImport";
import { addManyToCollection, fetchBinders, setBinderCardQuantity } from "../lib/mtg";

const SOURCES = [
  { id: "manabox", label: "ManaBox", note: "MTG-only scanner app export." },
  { id: "collectr", label: "Collectr", note: "Multi-game — only Magic rows can be matched right now." },
  { id: "csv", label: "Generic CSV", note: "TCGPlayer, Moxfield, or any CSV with name/set/quantity columns." },
];

export default function CsvImportPage({ onBack, userId }) {
  const [step, setStep] = useState("source"); // source | upload | resolving | review | done
  const [source, setSource] = useState("manabox");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]); // resolved rows
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState("");

  const [binders, setBinders] = useState([]);
  const [targetBinderId, setTargetBinderId] = useState("");
  const [committing, setCommitting] = useState(false);
  const [commitSummary, setCommitSummary] = useState(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError("");

    try {
      const text = await file.text();
      const { rows: parsedRows } = parseCsv(text);
      if (parsedRows.length === 0) {
        setError("That file didn't have any real rows to import — check it's a genuine CSV export.");
        return;
      }
      const mapped = parsedRows.map(mapCsvRow);
      setStep("resolving");
      setProgress({ done: 0, total: mapped.length });
      const resolved = await resolveCsvRows(mapped, (done, total) => setProgress({ done, total }));
      setRows(resolved.map((r, i) => ({ ...r, id: i, keep: r.status === "matched" })));
      setStep("review");

      fetchBinders(userId)
        .then(setBinders)
        .catch((err) => console.error("Failed to load binders for import target:", err));
    } catch (err) {
      console.error("CSV import failed to parse/resolve:", err);
      setError(err.message || "Couldn't read that file.");
      setStep("upload");
    }
  }

  function toggleKeep(id) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, keep: !r.keep } : r)));
  }

  async function handleCommit() {
    const toCommit = rows.filter((r) => r.status === "matched" && r.keep);
    if (toCommit.length === 0) return;
    setCommitting(true);
    try {
      await addManyToCollection(
        userId,
        toCommit.map((r) => ({ card: r.card, quantity: r.quantity, foil: r.foil, condition: r.condition || "Near Mint", source }))
      );

      if (targetBinderId) {
        for (const r of toCommit) {
          await setBinderCardQuantity(targetBinderId, r.card, r.quantity, { foil: r.foil, condition: r.condition || "Near Mint", source });
        }
      }

      setCommitSummary({ imported: toCommit.length, skipped: rows.length - toCommit.length });
      setStep("done");
    } catch (err) {
      console.error("Failed to commit CSV import:", err);
      setError(err.message || "Import failed partway through.");
    }
    setCommitting(false);
  }

  const matched = rows.filter((r) => r.status === "matched");
  const unmatched = rows.filter((r) => r.status === "unmatched" || r.status === "error");
  const unsupported = rows.filter((r) => r.status === "unsupported-game");
  const keptCount = matched.filter((r) => r.keep).length;

  return (
    <div className="price-page">
      <div className="price-page__head">
        <button type="button" className="back-link" onClick={onBack}>← Back</button>
        <h1 className="price-page__title">Import Collection</h1>
        <p className="price-page__subtitle">
          Upload a real export from ManaBox, Collectr, or any CSV — matched against real Scryfall data, nothing invented for cards that don't resolve.
        </p>
      </div>

      {step === "source" && (
        <div className="import-source-grid">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`import-source-card ${source === s.id ? "import-source-card--selected" : ""}`}
              onClick={() => setSource(s.id)}
              aria-pressed={source === s.id}
            >
              <span className="import-source-card__label">{s.label}</span>
              <span className="import-source-card__note">{s.note}</span>
            </button>
          ))}
          <button type="button" className="price-search__button" style={{ marginTop: "12px" }} onClick={() => setStep("upload")}>
            Continue
          </button>
        </div>
      )}

      {step === "upload" && (
        <div className="backlog-add" style={{ flexDirection: "column", alignItems: "flex-start" }}>
          <p className="settings-card__note">Importing as: <strong>{SOURCES.find((s) => s.id === source)?.label}</strong></p>
          <label className="settings-avatar__upload">
            Choose CSV file
            <input type="file" accept=".csv,text/csv" onChange={handleFile} hidden />
          </label>
          {error && <p className="panel__status panel__status--error">{error}</p>}
        </div>
      )}

      {step === "resolving" && (
        <p className="panel__status">
          Matching {fileName} against real Scryfall data… {progress.done} / {progress.total}
        </p>
      )}

      {step === "review" && (
        <>
          <div className="backlog-summary">
            <div className="panel__stat">
              <span className="panel__stat-value">{matched.length}</span>
              <span className="panel__stat-label">Matched</span>
            </div>
            <div className="panel__stat">
              <span className="panel__stat-value">{unmatched.length}</span>
              <span className="panel__stat-label">Unmatched</span>
            </div>
            {unsupported.length > 0 && (
              <div className="panel__stat">
                <span className="panel__stat-value">{unsupported.length}</span>
                <span className="panel__stat-label">Not supported yet</span>
              </div>
            )}
          </div>

          {binders.length > 0 && (
            <label className="auth-form__field">
              <span>Also add to a binder (optional)</span>
              <select value={targetBinderId} onChange={(e) => setTargetBinderId(e.target.value)}>
                <option value="">Just my collection</option>
                {binders.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
          )}

          <p className="settings-card__note">Real Scryfall matches — uncheck any you don't want imported.</p>
          <ul className="backlog-list">
            {matched.map((r) => (
              <li key={r.id} className="backlog-card">
                {r.card.imageSmall ? (
                  <img src={r.card.imageSmall} alt="" className="backlog-card__thumb" style={{ width: "48px", height: "67px" }} loading="lazy" decoding="async" />
                ) : (
                  <div className="backlog-card__thumb backlog-card__thumb--placeholder" style={{ width: "48px", height: "67px" }} />
                )}
                <div className="backlog-card__info">
                  <span className="backlog-card__title">{r.card.name}</span>
                  <span className="backlog-card__meta">
                    {r.card.setCode?.toUpperCase()} · Qty {r.quantity}{r.foil ? " · Foil" : ""}
                  </span>
                </div>
                <label className="backlog-card__hours">
                  <input type="checkbox" checked={r.keep} onChange={() => toggleKeep(r.id)} />
                  Import
                </label>
              </li>
            ))}
          </ul>

          {unmatched.length > 0 && (
            <>
              <p className="settings-card__note">Couldn't match ({unmatched.length}) — not imported:</p>
              <ul className="backlog-list">
                {unmatched.map((r) => (
                  <li key={r.id} className="backlog-card">
                    <div className="backlog-card__info">
                      <span className="backlog-card__title">{r.name || "(no name in row)"}</span>
                      <span className="backlog-card__meta">{r.reason}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {unsupported.length > 0 && (
            <p className="panel__status">
              {unsupported.length} row{unsupported.length === 1 ? "" : "s"} for other games ({[...new Set(unsupported.map((r) => r.game))].join(", ")}) —
              only Magic can be matched right now, so these weren't imported.
            </p>
          )}

          {error && <p className="panel__status panel__status--error">{error}</p>}

          <button type="button" className="price-search__button" onClick={handleCommit} disabled={keptCount === 0 || committing}>
            {committing ? "Importing…" : `Import ${keptCount} card${keptCount === 1 ? "" : "s"}`}
          </button>
        </>
      )}

      {step === "done" && commitSummary && (
        <div className="empty-state">
          <span className="empty-state__icon" aria-hidden="true">✅</span>
          <p className="empty-state__body">
            Imported {commitSummary.imported} card{commitSummary.imported === 1 ? "" : "s"} from {SOURCES.find((s) => s.id === source)?.label}
            {commitSummary.skipped > 0 ? ` (${commitSummary.skipped} left out)` : ""}.
          </p>
          <button type="button" className="linking-row__connect" onClick={onBack}>Back to My Collection</button>
        </div>
      )}
    </div>
  );
}
