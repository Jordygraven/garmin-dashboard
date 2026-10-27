import { Pool } from "pg";

// Read-only role. Every query is schema-qualified `garmin.*`; nothing reads `public`.
// TLS is controlled by GARMIN_READER_DB_URL (e.g. ?sslmode=require); verification is not disabled here.
const g = globalThis as unknown as { _pool?: Pool };

export const pool =
  g._pool ?? (g._pool = new Pool({ connectionString: process.env.GARMIN_READER_DB_URL, max: 3 }));
