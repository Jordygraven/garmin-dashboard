"use client";
import { useState } from "react";

export default function Login() {
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = new FormData(e.currentTarget).get("password");
    const r = await fetch("/api/login", { method: "POST", body: JSON.stringify({ password }) });
    if (r.ok) location.href = "/";
    else setErr(r.status === 429 ? "Too many attempts. Try later." : "Wrong password.");
  }
  return (
    <form className="page" onSubmit={submit} style={{ justifyContent: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 600 }}>Health</div>
      <input className="input" name="password" type="password" placeholder="Password" autoComplete="current-password" autoFocus />
      {err && <div style={{ color: "#d9534f", fontSize: 14 }}>{err}</div>}
      <button className="btn" type="submit">Sign in</button>
    </form>
  );
}
