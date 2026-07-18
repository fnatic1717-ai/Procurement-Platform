export type PreparedIdempotency = { key: string; payload: unknown; operation: string };

type Entry = { canonicalPayload: string; key: string; processing: boolean; completed: boolean };

export function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalize(entry)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, nested]) => nested !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalize(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export class IdempotencyStore {
  private entries = new Map<string, Entry>();

  prepare(operation: string, payload: unknown): PreparedIdempotency | null {
    const canonicalPayload = canonicalize(payload);
    const existing = this.entries.get(operation);
    if (existing?.processing) return null;
    if (existing && !existing.completed && existing.canonicalPayload === canonicalPayload) {
      existing.processing = true;
      return { key: existing.key, payload, operation };
    }
    const entry = {
      canonicalPayload,
      key: crypto.randomUUID(),
      processing: true,
      completed: false,
    };
    this.entries.set(operation, entry);
    return { key: entry.key, payload, operation };
  }

  finish(operation: string, success: boolean) {
    const entry = this.entries.get(operation);
    if (!entry) return;
    entry.processing = false;
    if (success) entry.completed = true;
  }
}
