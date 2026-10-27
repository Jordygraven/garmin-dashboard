"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SyncButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "fail">("idle");
  async function sync() {
    setState("busy");
    const r = await fetch("/api/sync", { method: "POST" }).catch(() => null);
    setState(r?.ok ? "idle" : "fail");
    if (r?.ok) router.refresh();
  }
  return (
    <button className="btn" onClick={sync} disabled={state === "busy"}>
      {state === "busy" ? "Syncing…" : state === "fail" ? "Sync failed. Try again" : "Sync now"}
    </button>
  );
}
