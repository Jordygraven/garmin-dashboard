export type Anchor = "start" | "middle" | "end";
export type Box = { left: number; right: number };
export type Tick = { index: number; x: number; anchor: Anchor; text: string; box: Box };

export const CHAR_PX = 5.8; // ~10px sans-serif
export const MAX_TICKS = 5;
export const TICK_GAP = 8;

export const textWidth = (text: string) => text.length * CHAR_PX;

export function textBox(x: number, anchor: Anchor, text: string): Box {
  const w = textWidth(text);
  return anchor === "start" ? { left: x, right: x + w } : anchor === "end" ? { left: x - w, right: x } : { left: x - w / 2, right: x + w / 2 };
}

export const overlaps = (a: Box, b: Box, gap = 0) => a.left < b.right + gap && b.left < a.right + gap;

/**
 * Pick x-axis labels by pixel width: first and last always, up to MAX_TICKS in total,
 * dropping any label that would touch the previous one. `xOf` maps a point index to its x.
 */
export function pickTicks(labels: string[], xOf: (i: number) => number, width: number): Tick[] {
  const n = labels.length;
  if (n === 0) return [];
  const make = (index: number, anchor: Anchor): Tick => {
    const x = xOf(index);
    return { index, x, anchor, text: labels[index], box: textBox(x, anchor, labels[index]) };
  };
  if (n === 1) return [make(0, "end")];

  const first = make(0, "start");
  const last = make(n - 1, "end");
  const ticks: Tick[] = [first];
  const wanted = new Set(Array.from({ length: MAX_TICKS }, (_, k) => Math.round((k * (n - 1)) / (MAX_TICKS - 1))));
  for (const index of [...wanted].sort((a, b) => a - b)) {
    if (index === 0 || index === n - 1) continue;
    const t = make(index, "middle");
    const prev = ticks[ticks.length - 1];
    if (t.box.left < 0 || t.box.right > width) continue;
    if (overlaps(t.box, prev.box, TICK_GAP) || overlaps(t.box, last.box, TICK_GAP)) continue;
    ticks.push(t);
  }
  ticks.push(overlaps(last.box, first.box, TICK_GAP) ? { ...last, anchor: "end" } : last);
  return ticks;
}
