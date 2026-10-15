import type { APIContext } from "astro";

type Cache = APIContext["cache"];

const TAG = "guestbook";

export function cacheGuestbook(cache: Cache) {
  if (cache.enabled)
    cache.set({ maxAge: 60 * 60 * 24, swr: 60 * 60 * 24 * 7, tags: [TAG] });
}

export async function invalidateGuestbook(cache: Cache) {
  if (!cache.enabled) return;
  try {
    await cache.invalidate({ tags: [TAG] });
  } catch (error) {
    console.error("Error purging the guestbook cache:", error);
  }
}
