import { db, Guestbook as GuestbookTable, eq, sql } from "astro:db";
import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const rawId = Number(data?.id);

    if (!Number.isInteger(rawId) || rawId <= 0) {
      return new Response(JSON.stringify({ error: "Invalid id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const updated = await db
      .update(GuestbookTable)
      .set({
        heartCount: sql`COALESCE(${GuestbookTable.heartCount}, 0) + 1`,
      })
      .where(eq(GuestbookTable.id, rawId))
      .returning({
        id: GuestbookTable.id,
        heartCount: GuestbookTable.heartCount,
      });

    if (updated.length === 0) {
      return new Response(JSON.stringify({ error: "Message not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(updated[0]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error updating reaction:", error);
    return new Response(JSON.stringify({ error: "Failed to react" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
