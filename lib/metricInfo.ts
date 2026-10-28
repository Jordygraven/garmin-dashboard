import type { MetricKey } from "./metricSource";

/** Modal title and explanation per metric. Wording lives here for review. */
export const METRIC_INFO: Record<MetricKey, { title: string; text: string }> = {
  readiness: {
    title: "Training readiness",
    text: "Garmin's 0-100 score for how ready your body is for hard training today. It weighs sleep, recovery time, recent training load, HRV and stress. Higher means more ready.",
  },
  fitness: {
    title: "Fitness",
    text: "Your chronic training load (CTL): a rolling average of your training stress over about six weeks. It rises slowly with consistent training and falls when you rest or skip sessions.",
  },
  vo2: {
    title: "VO2 max",
    text: "The most oxygen your body can use during hard exercise, in ml/kg/min. Garmin estimates it from your runs. Higher usually means better endurance fitness.",
  },
  bodyBattery: {
    title: "Body battery",
    text: "Garmin's energy reserve from 0 to 100. Charged is how much you gained, mostly from sleep and rest. Drained is how much you spent through activity and stress. The chart shows charged.",
  },
  restingHr: {
    title: "Resting HR",
    text: "Your lowest steady heart rate at rest, in beats per minute. A lower number usually means better fitness. A jump of several beats can signal fatigue, illness or poor sleep.",
  },
  stress: {
    title: "Stress",
    text: "Garmin's average stress score for the day, 0-100, based on heart rate variability. Lower means calmer. Training, poor sleep and illness all push it up.",
  },
  sleep: {
    title: "Sleep score",
    text: "Garmin's 0-100 rating of last night's sleep. It combines duration, sleep stages, restlessness and recovery. Higher is better.",
  },
  hrv: {
    title: "HRV",
    text: "Heart rate variability overnight, in milliseconds: the variation between heartbeats. Higher usually means you are well recovered. Compare it with your own normal, not with other people.",
  },
  fitnessAge: {
    title: "Fitness age",
    text: "The age Garmin estimates your body matches in fitness, based on VO2 max, resting heart rate and body composition. Lower than your real age is good.",
  },
};
