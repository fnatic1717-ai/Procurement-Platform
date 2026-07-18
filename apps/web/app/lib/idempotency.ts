export class IdempotencyStore {
  private keys = new Map<
    string,
    { payload: string; key: string; processing: boolean; completed: boolean }
  >();
  keyFor(operation: string, payload: unknown) {
    const normalized = JSON.stringify(payload, Object.keys(payload as object).sort());
    const existing = this.keys.get(operation);
    if (existing && !existing.completed && existing.payload === normalized) return existing.key;
    const key = crypto.randomUUID();
    this.keys.set(operation, { payload: normalized, key, processing: false, completed: false });
    return key;
  }
  start(operation: string) {
    const item = this.keys.get(operation);
    if (item?.processing) return false;
    if (item) item.processing = true;
    return true;
  }
  finish(operation: string, success: boolean) {
    const item = this.keys.get(operation);
    if (item) {
      item.processing = false;
      if (success) item.completed = true;
    }
  }
}
