import FitnessChart from "@/components/FitnessChart";
import { changeOver, dropCheck, trendLabel } from "@/lib/drop";
import { hms } from "@/lib/format";
import { LOAD_HIGH, LOAD_LOW, LOAD_SCALE, loadColor, loadZone, type LoadZone } from "@/lib/loadRatio";
import { GOAL_INFO, LOAD_ZONE_INFO, METRIC_INFO } from "@/lib/metricInfo";
import { paceLabel } from "@/lib/pace";
import { projectGoal, projectionText } from "@/lib/projection";
import { progressPct } from "@/lib/progress";
import { halfMarathon, halfSeries, metricSeries, unresolvedDrop } from "@/lib/queries";

export const dynamic = "force-dynamic";

const muted = { fontSize: 14, color: "#9aa8a0", lineHeight: 1.5 } as const;

export default async function Goals() {
  const [half, preds, load, vo2, ctl, alert] = await Promise.all([
    halfMarathon(), halfSeries(), metricSeries("loadRatio"), metricSeries("vo2"), metricSeries("fitness"), unresolvedDrop(),
  ]);
  const pct = half ? progressPct(half.start, half.current, half.target) : 0;
  const loadNow = load.at(-1)?.value;
  const zone = loadNow === undefined ? null : loadZone(loadNow);
  const vo2Now = vo2.at(-1);
  const ctlNow = ctl.at(-1);
  const change = changeOver(ctl);
  const trend = trendLabel(change);
  const drop = dropCheck(alert, change);

  return (
    <main className="page" style={{ gap: 20 }}>
      <div style={{ fontSize: 22, fontWeight: 600 }}><a href="/" style={{ textDecoration: "none" }}>←</a> Goals</div>

      <div className="card">
        <div className="label">Half marathon · {half ? `${hms(half.target)} target` : "progress"}</div>
        {half ? (
          <>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 8 }}>
              <div style={{ fontSize: 30, fontWeight: 600 }}>{hms(half.current)}</div>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "#222b26", marginTop: 16 }}>
              <div style={{ height: 6, width: `${pct}%`, borderRadius: 3, background: "#9aa8a0" }} />
            </div>
            <div style={{ fontSize: 12, color: "#7d8c83", marginTop: 8 }}>Target pace {paceLabel(half.target)}</div>
            {preds.length >= 2 ? (
              <FitnessChart points={preds} label="Half marathon prediction" plateaus={false} target={half.target} targetLabel="sub 1:30" invert format={hms} />
            ) : (
              <div style={{ ...muted, marginTop: 16 }}>Building history</div>
            )}
            <div style={{ fontSize: 16, marginTop: 12 }}>{projectionText(projectGoal(preds, half.target, half.due))}</div>
            <div style={{ ...muted, fontSize: 12, marginTop: 4 }}>This will compare with your training plan once we add it.</div>
            <div style={{ ...muted, marginTop: 8 }}>{GOAL_INFO.halfMarathon}</div>
          </>
        ) : (
          <div style={{ fontSize: 16, color: "#9aa8a0", marginTop: 10 }}>Waiting for data</div>
        )}
      </div>

      <div className="card">
        <div className="label">Load ratio</div>
        {loadNow === undefined || !zone ? (
          <div style={{ fontSize: 16, color: "#9aa8a0", marginTop: 10 }}>Waiting for data</div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
              <div style={{ fontSize: 34, fontWeight: 600 }}>{loadNow.toFixed(2)}</div>
              <div style={{ fontSize: 14, color: loadColor(loadNow) }}>{zone}</div>
            </div>
            <div style={{ position: "relative", height: 8, borderRadius: 4, background: "#f0a03c", marginTop: 16 }}>
              <div style={{
                position: "absolute", top: 0, height: 8, background: "#2f8f5b",
                left: `${(LOAD_LOW / LOAD_SCALE) * 100}%`, width: `${((LOAD_HIGH - LOAD_LOW) / LOAD_SCALE) * 100}%`,
              }} />
              <div style={{ position: "absolute", top: -4, width: 3, height: 16, background: "#eef3ef", left: `${Math.min(1, loadNow / LOAD_SCALE) * 100}%` }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#7d8c83", marginTop: 8 }}>
              <span>0</span><span>2.0</span>
            </div>
            <FitnessChart points={load} label="Load ratio" plateaus={false} zone={[LOAD_LOW, LOAD_HIGH]} format={(v) => v.toFixed(2)} />
            <div style={{ ...muted, marginTop: 8, color: "#eef3ef" }}>
              <b>{LOAD_ZONE_INFO[zone].range}: {zone}</b>
            </div>
            <details style={{ marginTop: 4 }}>
              <summary style={{ ...muted, cursor: "pointer" }}>
                <span className="when-closed">Show more</span><span className="when-open">Show less</span>
              </summary>
              <div style={{ ...muted, marginTop: 4 }}>{GOAL_INFO.loadRatio}</div>
              {(["Low", "Good", "High"] as LoadZone[]).map((z) => (
                <div key={z} style={{ ...muted, marginTop: 8, color: z === zone ? "#eef3ef" : "#7d8c83" }}>
                  <b>{LOAD_ZONE_INFO[z].range}:</b> {LOAD_ZONE_INFO[z].text}
                </div>
              ))}
            </details>
          </>
        )}
      </div>

      <div className="card">
        <div className="label">VO2 max</div>
        {vo2Now ? (
          <>
            <div style={{ fontSize: 34, fontWeight: 600, marginTop: 8 }}>{Math.round(vo2Now.value)}</div>
            <FitnessChart points={vo2} label="VO2 max" plateaus={false} />
            <div style={{ ...muted, marginTop: 8 }}>{METRIC_INFO.vo2.text}</div>
          </>
        ) : (
          <div style={{ fontSize: 16, color: "#9aa8a0", marginTop: 10 }}>Waiting for data</div>
        )}
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div className="label">Fitness</div>
          {trend && <div style={{ fontSize: 13, color: trend.word === "Decreasing" ? "#d9534f" : "#8fd18a" }}>{trend.arrow} {trend.word}</div>}
        </div>
        {ctlNow ? (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
              <div style={{ fontSize: 34, fontWeight: 600 }}>{Math.round(ctlNow.value)}</div>
              {change !== null && (
                <div style={{ fontSize: 14, color: "#9aa8a0" }}>{change >= 0 ? "+" : "−"}{Math.round(Math.abs(change) * 100)}% in 14 days</div>
              )}
            </div>
            <FitnessChart points={ctl} />
            <div style={{ ...muted, marginTop: 8, color: drop.state === "warning" ? "#d9534f" : "#9aa8a0" }}>
              {drop.state === "warning" ? `Warning: ${drop.text}` : drop.text}
            </div>
            <div style={{ ...muted, marginTop: 8 }}>{METRIC_INFO.fitness.text}</div>
          </>
        ) : (
          <div style={{ fontSize: 16, color: "#9aa8a0", marginTop: 10 }}>Waiting for data</div>
        )}
      </div>
    </main>
  );
}
