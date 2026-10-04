/** Tab-local, bounded immutable results. No localStorage, service worker or user-global state. */
export interface CachedAnswer<T> { value: T; bytes: number; identity: string }
type Flight<T> = { promise: Promise<CachedAnswer<T>>; controller: AbortController; users: number };
const abortError = () => new DOMException('The request was cancelled.', 'AbortError');

export class AssistPreload<T> {
  private entries = new Map<string, CachedAnswer<T>>();
  private flights = new Map<string, Flight<T>>();
  constructor(private readonly maxEntries = 8, private readonly maxBytes = 128 * 1024 * 1024) {}

  clear() { this.entries.clear(); }
  has(key: string) { return this.entries.has(key); }

  async get(key: string, identity: string | null, load: (signal: AbortSignal) => Promise<CachedAnswer<T>>, signal?: AbortSignal): Promise<{ value: T; preloaded: boolean }> {
    if (signal?.aborted) throw abortError();
    const cached = this.entries.get(key);
    if (cached && identity !== null && cached.identity === identity) {
      this.entries.delete(key);
      this.entries.set(key, cached);
      return { value: cached.value, preloaded: true };
    }
    this.entries.delete(key);
    let flight = this.flights.get(key);
    if (!flight || flight.controller.signal.aborted) {
      const controller = new AbortController();
      const next: Flight<T> = { controller, users: 0, promise: Promise.resolve(null as never) };
      next.promise = load(controller.signal).then((answer) => {
        if (!controller.signal.aborted && answer.bytes <= this.maxBytes) {
          this.entries.set(key, answer);
          while (this.entries.size > this.maxEntries || [...this.entries.values()].reduce((n, v) => n + v.bytes, 0) > this.maxBytes) {
            const oldest = this.entries.keys().next().value;
            if (oldest === undefined) break;
            this.entries.delete(oldest);
          }
        }
        return answer;
      }).finally(() => { if (this.flights.get(key) === next) this.flights.delete(key); });
      this.flights.set(key, next);
      flight = next;
    }
    const joined = flight;
    joined.users++;
    return new Promise((resolve, reject) => {
      let finished = false;
      const finish = () => {
        if (finished) return false;
        finished = true;
        signal?.removeEventListener('abort', cancel);
        joined.users--;
        if (joined.users === 0) joined.controller.abort();
        return true;
      };
      const cancel = () => { if (finish()) reject(abortError()); };
      signal?.addEventListener('abort', cancel, { once: true });
      joined.promise.then(
        (answer) => { if (finish()) resolve({ value: answer.value, preloaded: false }); },
        (error: unknown) => { if (finish()) reject(error); },
      );
      if (signal?.aborted) cancel();
    });
  }
}
