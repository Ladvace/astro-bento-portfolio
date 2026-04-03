import { db, Guestbook as GuestbookTable } from "astro:db";
import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  try {
    const allEntries = await db.select().from(GuestbookTable);
    const entries = allEntries.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    return new Response(JSON.stringify(entries), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error fetching guestbook entries:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch guestbook entries" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
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
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const sanitizedName = name.trim().slice(0, 100);
    const sanitizedMessage = message.trim().slice(0, 1000);
    const sanitizedWebsite = website ? website.trim().slice(0, 200) : null;

    const result = await db.insert(GuestbookTable).values({
      name: sanitizedName,
      message: sanitizedMessage,
      website: sanitizedWebsite || undefined,
      createdAt: new Date(),
    }).returning();

    return new Response(JSON.stringify(result[0]), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error creating guestbook entry:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create guestbook entry" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
};

