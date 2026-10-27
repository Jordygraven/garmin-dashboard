import Spark from "@/components/Spark";
import SyncButton from "@/components/SyncButton";
import { changeOver } from "@/lib/drop";
import { dash, syncedLabel, todayHeader } from "@/lib/format";
import { ctlSeries, lastSynced, latestDaily, latestReadiness, latestSnapshot } from "@/lib/queries";
import { levelOf, phraseFor, readinessLabel, STEPS } from "@/lib/verdict";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [daily, synced, readiness, snap, ctl] = await Promise.all([
    latestDaily(), lastSynced(), latestReadiness(), latestSnapshot(), ctlSeries(30),
  ]);
  const level = levelOf(readiness);
  const [head, sub] = phraseFor(level);
  const accent = STEPS.find((s) => s.key === level)?.color ?? "#2a3530";
  const change = changeOver(ctl);
  const trend = change === null ? null : change > 0.02 ? "Increasing" : change < -0.02 ? "Decreasing" : "Steady";
  const trendColor = trend === "Decreasing" ? "#d9534f" : "#8fd18a";
  const last = ctl[ctl.length - 1];
  const tiles: [string, string][] = [
    ["Sleep score", dash(daily?.sleep_score)],
    ["HRV", dash(daily?.hrv)],
    ["Body battery", daily?.bb_charged != null || daily?.bb_drained != null ? `+${dash(daily?.bb_charged)} / −${dash(daily?.bb_drained)}` : "–"],
    ["Resting HR", daily?.resting_hr != null ? `${daily.resting_hr} bpm` : "–"],
    ["Stress", dash(daily?.stress)],
  ];

  return (
    <main className="page">
      <div className="label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
        <span>{todayHeader()}</span>
        <span>{syncedLabel(synced)}</span>
      </div>
      <div>
        <div style={{ width: 28, height: 3, borderRadius: 2, background: accent, marginBottom: 18 }} />
        <div style={{ fontSize: 34, fontWeight: 600, lineHeight: 1.1 }}>{head}</div>
        <div style={{ fontSize: 16, color: "#9aa8a0", marginTop: 10, lineHeight: 1.45 }}>{sub}</div>
      </div>
      <div>
        <div style={{ display: "flex", gap: 4, height: 6 }}>
          {STEPS.map((s) => (
            <div key={s.key} style={{ flex: 1, borderRadius: 3, background: s.color, opacity: s.key === level ? 1 : 0.35 }} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#7d8c83", marginTop: 8 }}>
          {STEPS.map((s) => (
            <span key={s.key} style={s.key === level ? { color: "#eef3ef" } : undefined}>{s.label}</span>
          ))}
        </div>
      </div>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div className="label">Fitness</div>
          {trend && <div style={{ fontSize: 13, color: trendColor }}>{trend}</div>}
        </div>
        {last ? (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 6 }}>
              <div style={{ fontSize: 40, fontWeight: 600 }}>{Math.round(last.value)}</div>
              {change !== null && (
                <div style={{ fontSize: 14, color: "#9aa8a0" }}>
                  {change >= 0 ? "+" : "−"}{Math.round(Math.abs(change) * 100)}% in 14 days
                </div>
              )}
            </div>
            <Spark points={ctl} />
          </>
        ) : (
          <div style={{ fontSize: 16, color: "#9aa8a0", marginTop: 10 }}>Waiting for data</div>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>
        {tiles.map(([k, v]) => (
          <div className="tile" key={k}>
            <div style={{ fontSize: 12, color: "#7d8c83" }}>{k}</div>
            <div style={{ fontSize: 26, fontWeight: 600, marginTop: 6 }}>{v}</div>
          </div>
        ))}
        <div className="tile">
          <div style={{ fontSize: 12, color: "#7d8c83" }}>Fitness age</div>
          <div style={{ fontSize: 18, fontWeight: 600, marginTop: 10, color: "#9aa8a0" }}>{dash(daily?.fitness_age)}</div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#9aa8a0", padding: "0 4px" }}>
        <span>VO2 max <span style={{ color: "#eef3ef" }}>{dash(snap?.vo2)}</span></span>
        <span>Readiness <span style={{ color: "#eef3ef" }}>{readinessLabel(readiness)}</span></span>
      </div>
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
        <SyncButton />
        <a href="/trends" style={{ textAlign: "center", fontSize: 14, color: "#9aa8a0", textDecoration: "none" }}>Trends →</a>
      </div>
    </main>
  );
}
