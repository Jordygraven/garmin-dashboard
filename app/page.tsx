import HomeMetrics, { type Metric } from "@/components/HomeMetrics";
import SyncButton from "@/components/SyncButton";
import { changeOver, trendLabel } from "@/lib/drop";
import { dash, syncedLabel, todayHeader } from "@/lib/format";
import { lastSynced, latestDaily, latestReadiness, latestSnapshot, metricSeries } from "@/lib/queries";
import type { MetricKey, SourceKey } from "@/lib/metricSource";
import { levelOf, phraseFor, readinessLabel, STEPS } from "@/lib/verdict";

export const dynamic = "force-dynamic";

export default async function Home() {
  const keys: SourceKey[] = ["readiness", "fitness", "bodyBattery", "restingHr", "stress", "sleep", "hrv", "fitnessAge", "vo2", "bodyBatteryDrained"];
  const [daily, synced, readiness, snap, ...all] = await Promise.all([
    latestDaily(), lastSynced(), latestReadiness(), latestSnapshot(), ...keys.map((k) => metricSeries(k)),
  ]);
  const series = Object.fromEntries(keys.map((k, i) => [k, all[i]])) as Record<SourceKey, (typeof all)[number]>;
  const level = levelOf(readiness);
  const [head, sub] = phraseFor(level);
  const accent = STEPS.find((s) => s.key === level)?.color ?? "#2a3530";
  const change = changeOver(series.fitness);
  const trend = trendLabel(change);
  const last = series.fitness[series.fitness.length - 1];
  const bb = daily?.bb_charged != null || daily?.bb_drained != null;
  const tile = (key: MetricKey, label: string, value: string, sub?: string): Metric => ({ key, label, value, sub, series: series[key], drained: key === "bodyBattery" ? series.bodyBatteryDrained : undefined });
  const tiles = [
    tile("readiness", "Training readiness", readinessLabel(readiness)),
    tile("fitness", "Fitness", last ? String(Math.round(last.value)) : "–",
      change === null || !trend ? undefined : `${trend.arrow} ${change >= 0 ? "+" : "−"}${Math.round(Math.abs(change) * 100)}% in 14 days`),
    tile("bodyBattery", "Body battery", bb ? `+${dash(daily?.bb_charged)} / −${dash(daily?.bb_drained)}` : "–"),
    tile("restingHr", "Resting HR", daily?.resting_hr != null ? `${daily.resting_hr} bpm` : "–"),
    tile("stress", "Stress", dash(daily?.stress)),
    tile("sleep", "Sleep score", dash(daily?.sleep_score)),
    tile("hrv", "HRV", dash(daily?.hrv)),
    tile("fitnessAge", "Fitness age", dash(daily?.fitness_age)),
  ];
  const headline = tile("vo2", "VO2 max", dash(snap?.vo2));

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
      <HomeMetrics headline={headline} tiles={tiles} />
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
        <SyncButton />
        <a href="/goals" style={{ textAlign: "center", fontSize: 14, color: "#9aa8a0", textDecoration: "none" }}>Goals →</a>
      </div>
    </main>
  );
}
