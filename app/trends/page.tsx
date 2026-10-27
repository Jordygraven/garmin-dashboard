import FitnessChart from "@/components/FitnessChart";
import { changeOver, dropCheck } from "@/lib/drop";
import { dash, hms, signedHms } from "@/lib/format";
import { ctlSeries, goals, latestSnapshot, predictions, unresolvedDrop } from "@/lib/queries";

export const dynamic = "force-dynamic";

const nameOf = (label: string) => (/half/i.test(label) ? "Half marathon" : /marathon/i.test(label) ? "Marathon" : label);
const MARKER = 98.5; // % along the bar where the target sits

export default async function Trends({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const range = (await searchParams).range === "90" ? 90 : 30;
  const [series, alert, snap, allGoals] = await Promise.all([ctlSeries(90), unresolvedDrop(), latestSnapshot(), goals()]);
  const cutoff = new Date(Date.now() + 8 * 3600_000 - range * 86_400_000).toISOString().slice(0, 10);
  const points = series.filter((p) => p.day >= cutoff);
  const change = changeOver(series);
  const drop = dropCheck(alert, change);
  const trend = change === null ? null : change > 0.02 ? "Increasing" : change < -0.02 ? "Decreasing" : "Steady";

  const goal = allGoals.find((g) => /half/i.test(g.label)) ?? allGoals[0];
  const preds = goal ? await predictions(goal.distance) : [];
  const now = preds[preds.length - 1];
  const hasTrend = preds.length > 1 && Date.parse(now.day) - Date.parse(preds[0].day) >= 14 * 86_400_000;
  const gap = goal && now ? now.seconds - goal.target : 0;
  const behind = gap > 0;
  const color = behind ? "#d9534f" : "#2f8f5b";
  const fill = goal && now ? Math.min(100, (goal.target / now.seconds) * MARKER) : 0;
  const past = hasTrend ? [...preds].reverse().find((p) => Date.parse(p.day) <= Date.parse(now.day) - 14 * 86_400_000) : null;
  const delta = past ? now.seconds - past.seconds : 0;

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
          {trend && <div style={{ fontSize: 13, color: trend === "Decreasing" ? "#d9534f" : "#8fd18a" }}>{trend}</div>}
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
        {goal ? (
          <>
            <div className="label">{nameOf(goal.label)} · {hms(goal.target)} target</div>
            {now ? (
              <>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
                  <div style={{ fontSize: 30, fontWeight: 600 }}>{hms(now.seconds)}</div>
                  <div style={{ fontSize: 14, color }}>{signedHms(gap)}</div>
                </div>
                <div style={{ position: "relative", height: 6, borderRadius: 3, background: "#222b26", marginTop: 16 }}>
                  <div style={{ position: "absolute", left: 0, top: 0, height: 6, width: `${fill}%`, borderRadius: 3, background: color }} />
                  <div style={{ position: "absolute", left: `${MARKER}%`, top: -4, width: 2, height: 14, background: "#eef3ef" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#7d8c83", marginTop: 8 }}>
                  <span>Predicted today</span>
                  <span>{hasTrend ? `${delta <= 0 ? "Faster" : "Slower"} by ${hms(delta)} in 14 days` : "Trend needs history"}</span>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 16, color: "#9aa8a0", marginTop: 10 }}>Waiting for data</div>
            )}
          </>
        ) : (
          <div className="label">No goal set</div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#9aa8a0", padding: "0 4px" }}>
        <span>VO2 max <span style={{ color: "#eef3ef" }}>{dash(snap?.vo2)}</span></span>
        <span>Load ratio <span style={{ color: "#eef3ef" }}>{snap?.load_ratio != null ? snap.load_ratio.toFixed(1) : "–"}</span></span>
      </div>
    </main>
  );
}
