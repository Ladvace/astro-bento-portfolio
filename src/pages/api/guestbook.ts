import {
  db,
  Guestbook as GuestbookTable,
  desc,
  count,
  eq,
  isNull,
} from "../../lib/db";
import type { APIRoute } from "astro";
import { invalidateGuestbook } from "../../lib/guestbook-cache";
import { isGuestbookAdmin } from "../../lib/guestbook-auth";
import { ENTRIES_PER_PAGE } from "../../lib/guestbook";
import { SITE } from "../../site-config";

const errorResponse = (error: string, status: number): Response =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const isHttpUrl = (value: string): boolean => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

export const GET: APIRoute = async ({ url }) => {
  try {
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));

    const [[{ total }], entries] = await Promise.all([
      db
        .select({ total: count() })
        .from(GuestbookTable)
        .where(isNull(GuestbookTable.parentId)),
      db
        .select()
        .from(GuestbookTable)
        .where(isNull(GuestbookTable.parentId))
        .orderBy(desc(GuestbookTable.createdAt))
        .limit(ENTRIES_PER_PAGE)
        .offset((page - 1) * ENTRIES_PER_PAGE),
    ]);

    return new Response(
      JSON.stringify({
        entries,
        total,
        page,
        totalPages: Math.ceil(total / ENTRIES_PER_PAGE),
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
    return errorResponse("Failed to fetch guestbook entries", 500);
  }
};

export const POST: APIRoute = async ({ request, cache, cookies }) => {
  try {
    const { name, message, website, parentId } = await request.json();

    let author: {
      name: string;
      website: string | undefined;
      parentId?: number;
    };

    if (parentId !== undefined && parentId !== null) {
      if (!isGuestbookAdmin(cookies)) {
        return errorResponse("Log in to reply", 401);
      }
      if (!message) return errorResponse("Message is required", 400);
      if (!Number.isInteger(parentId) || parentId <= 0) {
        return errorResponse("Invalid parentId", 400);
      }

      const [parent] = await db
        .select({ parentId: GuestbookTable.parentId })
        .from(GuestbookTable)
        .where(eq(GuestbookTable.id, parentId))
        .limit(1);

      if (!parent) return errorResponse("Message not found", 404);
      if (parent.parentId !== null) {
        return errorResponse("Replies can't be replied to", 400);
      }

      author = { name: SITE.author.fullName, website: SITE.site.url, parentId };
    } else {
      if (!name || !message) {
        return errorResponse("Name and message are required", 400);
      }

      const websiteUrl =
        String(website ?? "")
          .trim()
          .slice(0, 200) || undefined;
      if (websiteUrl && !isHttpUrl(websiteUrl)) {
        return errorResponse(
          "Website must start with http:// or https://",
          400,
        );
      }

      author = { name: name.trim().slice(0, 100), website: websiteUrl };
    }

    const result = await db
      .insert(GuestbookTable)
      .values({
        ...author,
        message: message.trim().slice(0, 1000),
        createdAt: new Date(),
      })
      .returning();
    await invalidateGuestbook(cache);

    return new Response(JSON.stringify(result[0]), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error creating guestbook entry:", error);
    return errorResponse("Failed to create guestbook entry", 500);
  }
};
