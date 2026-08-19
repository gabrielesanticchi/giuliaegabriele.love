import "server-only";

type IdempotencyStore<T> = {
  load: (key: string) => Promise<T | undefined>;
  commit: (key: string, result: T) => Promise<void>;
};

export async function runIdempotentAdminMutation<T>(
  key: string,
  effect: () => Promise<T>,
  store: IdempotencyStore<T>
): Promise<{ result: T; replayed: boolean }> {
  if (!key.trim()) throw new TypeError("Chiave di idempotenza obbligatoria");
  const existing = await store.load(key);
  if (existing !== undefined) return { result: existing, replayed: true };
  const result = await effect();
  await store.commit(key, result);
  return { result, replayed: false };
}
