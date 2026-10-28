import FitnessChart from "@/components/FitnessChart";
import { changeOver, dropCheck, trendLabel } from "@/lib/drop";
import { dash, hms } from "@/lib/format";
import { progressPct } from "@/lib/progress";
import { ctlSeries, halfMarathon, latestSnapshot, unresolvedDrop } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Trends({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const range = (await searchParams).range === "90" ? 90 : 30;
  const [series, alert, snap, half] = await Promise.all([ctlSeries(90), unresolvedDrop(), latestSnapshot(), halfMarathon()]);
  const cutoff = new Date(Date.now() + 8 * 3600_000 - range * 86_400_000).toISOString().slice(0, 10);
  const points = series.filter((p) => p.day >= cutoff);
  const change = changeOver(series);
  const drop = dropCheck(alert, change);
  const trend = trendLabel(change);
  const pct = half ? progressPct(half.start, half.current, half.target) : 0;

  return (
    <main className="page" style={{ gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 600 }}><a href="/" style={{ textDecoration: "none" }}>←</a> Trends</div>
        <div style={{ display: "flex", gap: 6 }}>
          {[30, 90].map((r) => (
            <a key={r} href={`/trends?range=${r}`} style={{
              fontSize: 13, textDecoration: "none", borderRadius: 999, padding: "6px 12px",
              border: "1px solid #2a3530", color: r === range ? "#eef3ef" : "#9aa8a0", background: r === range ? "#141a17" : "transparent",
            }}>{r} days</a>
          ))}
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div className="label">Fitness</div>
          {trend && <div style={{ fontSize: 13, color: trend.word === "Decreasing" ? "#d9534f" : "#8fd18a" }}>{trend.arrow} {trend.word}</div>}
        </div>
        {points.length ? (
          <>
            <div style={{ fontSize: 34, fontWeight: 600, marginTop: 6 }}>{Math.round(points[points.length - 1].value)}</div>
            <FitnessChart points={points} />
          </>
        ) : (
          <div style={{ fontSize: 16, color: "#9aa8a0", marginTop: 10 }}>Waiting for data</div>
        )}
      </div>

      <div className="card" style={{
        padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center",
        ...(drop.state === "warning" ? { border: "1px solid #d9534f" } : {}),
      }}>
        <div>
          <div className="label">14-day check</div>
          <div style={{ fontSize: 16, marginTop: 6, color: drop.state === "warning" ? "#d9534f" : undefined }}>
            {drop.state === "warning" ? `Warning: ${drop.text}` : drop.text}
          </div>
        </div>
        <div style={{
          width: 12, height: 12, borderRadius: 6, flexShrink: 0,
          background: drop.state === "warning" ? "#d9534f" : drop.state === "ok" ? "#2f8f5b" : "#2a3530",
        }} />
      </div>

      <div className="card">
        <div className="label">Half marathon · {half ? `${hms(half.target)} target` : "progress"}</div>
        {half ? (
          <>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 8 }}>
              <div style={{ fontSize: 30, fontWeight: 600 }}>{hms(half.current)}</div>
              <div style={{ fontSize: 14, color: "#9aa8a0" }}>{Math.round(pct)}%</div>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "#222b26", marginTop: 16 }}>
              <div style={{ height: 6, width: `${pct}%`, borderRadius: 3, background: "#9aa8a0" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#7d8c83", marginTop: 8 }}>
              <span>Predicted now</span>
              <span>Target {hms(half.target)}</span>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 16, color: "#9aa8a0", marginTop: 10 }}>Waiting for data</div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#9aa8a0", padding: "0 4px" }}>
        <span>VO2 max <span style={{ color: "#eef3ef" }}>{dash(snap?.vo2)}</span></span>
        <span>Load ratio <span style={{ color: "#eef3ef" }}>{snap?.load_ratio != null ? snap.load_ratio.toFixed(1) : "–"}</span></span>
      </div>
    </main>
  );
}
