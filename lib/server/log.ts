/**
 * Log estruturado em JSON, uma linha por evento — pronto para coleta em
 * qualquer agregador (Vercel, CloudWatch, Loki, `grep` no stdout do dev).
 */
export type LogLevel = "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

export function log(level: LogLevel, event: string, fields: LogFields = {}): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
