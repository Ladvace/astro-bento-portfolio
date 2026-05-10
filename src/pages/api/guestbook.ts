import { db, Guestbook as GuestbookTable, desc, count } from "astro:db";
import type { APIRoute } from "astro";

const ITEMS_PER_PAGE = 10;

export const GET: APIRoute = async ({ url }) => {
  try {
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));

    const [{ total }] = await db
      .select({ total: count() })
      .from(GuestbookTable);
    const entries = await db
      .select()
      .from(GuestbookTable)
      .orderBy(desc(GuestbookTable.createdAt))
      .limit(ITEMS_PER_PAGE)
      .offset((page - 1) * ITEMS_PER_PAGE);

    return new Response(
      JSON.stringify({
        entries,
        total,
        page,
        totalPages: Math.ceil(total / ITEMS_PER_PAGE),
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching guestbook entries:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch guestbook entries" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const { name, message, website } = data;

    if (!name || !message) {
      return new Response(
        JSON.stringify({ error: "Name and message are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const result = await db
      .insert(GuestbookTable)
      .values({
        name: name.trim().slice(0, 100),
        message: message.trim().slice(0, 1000),
        website: website ? website.trim().slice(0, 200) : undefined,
        createdAt: new Date(),
      })
      .returning();

    return new Response(JSON.stringify(result[0]), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error creating guestbook entry:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create guestbook entry" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
