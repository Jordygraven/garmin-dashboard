"use client";
import { useEffect, useState } from "react";
import BarChart from "@/components/BarChart";
import FitnessChart from "@/components/FitnessChart";
import { METRIC_INFO } from "@/lib/metricInfo";
import type { MetricKey } from "@/lib/metricSource";
import type { Point } from "@/lib/plateau";
import { bodyBatteryBars, movingAvg, windowPoints, type Days } from "@/lib/series";

export type Metric = { key: MetricKey; label: string; value: string; sub?: string; series: Point[]; drained?: Point[] };

export default function HomeMetrics({ headline, tiles }: { headline: Metric; tiles: Metric[] }) {
  const [open, setOpen] = useState<Metric | null>(null);
  const [days, setDays] = useState<Days>(90);
  const show = (m: Metric) => { setDays(90); setOpen(m); };
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);
  const netToday = open?.key === "bodyBattery" ? bodyBatteryBars(open.series, open.drained ?? []).at(-1) : undefined;
  return (
    <>
      <button onClick={() => show(headline)} style={{ background: "none", border: 0, color: "inherit", textAlign: "center", padding: 0, cursor: "pointer" }}>
        <div style={{ fontSize: 64, fontWeight: 600, lineHeight: 1 }}>{headline.value}</div>
        <div style={{ fontSize: 13, color: "#7d8c83", marginTop: 6 }}>VO2 max</div>
      </button>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>
        {tiles.map((t) => (
          <button className="tile" key={t.key} onClick={() => show(t)}
            style={{ border: 0, color: "inherit", textAlign: "left", cursor: "pointer", minHeight: 88, font: "inherit" }}>
            <div style={{ fontSize: 12, color: "#7d8c83" }}>{t.label}</div>
            <div style={{ fontSize: 20, fontWeight: 600, marginTop: 8, overflowWrap: "anywhere" }}>{t.value}</div>
            {t.sub && <div style={{ fontSize: 12, color: "#9aa8a0", marginTop: 4 }}>{t.sub}</div>}
          </button>
        ))}
      </div>
      {open && (
        <div onClick={() => setOpen(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 10,
        }}>
          <div role="dialog" aria-modal="true" aria-label={METRIC_INFO[open.key].title} className="card"
            onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 400, maxHeight: "90dvh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div className="label">{METRIC_INFO[open.key].title}</div>
              <button onClick={() => setOpen(null)} aria-label="Close"
                style={{ background: "none", border: 0, color: "#9aa8a0", fontSize: 22, cursor: "pointer", padding: "0 0 0 12px" }}>×</button>
            </div>
            <div style={{ fontSize: 34, fontWeight: 600, marginTop: 6 }}>{open.value}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              {([30, 90] as const).map((d) => (
                <button key={d} onClick={() => setDays(d)} style={{
                  fontSize: 13, borderRadius: 999, padding: "6px 12px", cursor: "pointer", border: "1px solid #2a3530",
                  color: d === days ? "#eef3ef" : "#9aa8a0", background: d === days ? "#0b0f0d" : "transparent",
                }}>{d} days</button>
              ))}
            </div>
            {open.series.length ? (
              open.key === "bodyBattery" ? (
                <BarChart
                  bars={bodyBatteryBars(windowPoints(open.series, days), windowPoints(open.drained ?? [], days))}
                  avgCharged={windowPoints(movingAvg(open.series), days)}
                  avgDrained={windowPoints(movingAvg(open.drained ?? []), days)}
                />
              ) : (
                <FitnessChart
                  points={windowPoints(open.series, days)}
                  avg={windowPoints(movingAvg(open.series), days)}
                  label={METRIC_INFO[open.key].title}
                  plateaus={open.key === "fitness"}
                />
              )
            ) : (
              <div style={{ fontSize: 14, color: "#9aa8a0", margin: "16px 0" }}>No data yet</div>
            )}
            <div style={{ fontSize: 14, color: "#9aa8a0", lineHeight: 1.5, marginTop: 8 }}>
              {METRIC_INFO[open.key].text}
              {netToday && ` Latest net: ${netToday.net >= 0 ? "+" : "−"}${Math.round(Math.abs(netToday.net))}.`}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
