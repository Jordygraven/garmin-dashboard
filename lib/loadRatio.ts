export const LOAD_LOW = 0.8;
export const LOAD_HIGH = 1.3;
export const LOAD_SCALE = 2.0;

export type LoadZone = "Low" | "Good" | "High";

export const loadZone = (v: number): LoadZone => (v < LOAD_LOW ? "Low" : v > LOAD_HIGH ? "High" : "Good");
export const loadColor = (v: number) => (loadZone(v) === "Good" ? "#2f8f5b" : "#f0a03c");
