import type { APIRoute } from "astro";
import { isGuestbookAdmin } from "../../../lib/guestbook-auth";

export const GET: APIRoute = ({ cookies }) =>
  new Response(JSON.stringify({ admin: isGuestbookAdmin(cookies) }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
