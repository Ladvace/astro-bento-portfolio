export type GuestbookEntry = {
  id: number;
  name: string;
  message: string;
  website: string | null;
  heartCount: number | null;
  createdAt: Date | string;
};

export const ENTRIES_PER_PAGE = 10;

export const AVATAR_COLORS = [
  "bg-violet-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-indigo-500",
  "bg-teal-500",
  "bg-orange-500",
] as const;

export const getInitials = (fullName: string): string =>
  fullName
    .split(" ")
    .map((word) => word[0] || "")
    .join("")
    .toUpperCase()
    .slice(0, 2);

export const formatTimeAgo = (createdAt: Date | string): string => {
  const daysAgo = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / 86400000,
  );
  if (daysAgo <= 0) return "today";
  if (daysAgo === 1) return "yesterday";
  if (daysAgo < 30) return `${daysAgo}d ago`;
  if (daysAgo < 365) return `${Math.floor(daysAgo / 30)}mo ago`;
  return `${Math.floor(daysAgo / 365)}y ago`;
};

export const rotationFromSeed = (seed: number): number =>
  (((seed * 7) % 6) - 3) * 0.4;

export const avatarColorForSeed = (seed: number): string =>
  AVATAR_COLORS[
    ((seed % AVATAR_COLORS.length) + AVATAR_COLORS.length) %
      AVATAR_COLORS.length
  ];

export const PIXEL_HEART_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="12" viewBox="0 0 7 6" class="heart-svg block" shape-rendering="crispEdges" style="image-rendering:pixelated" fill="currentColor"><rect x="1" y="0" width="2" height="1"/><rect x="4" y="0" width="2" height="1"/><rect x="0" y="1" width="7" height="1"/><rect x="0" y="2" width="7" height="1"/><rect x="1" y="3" width="5" height="1"/><rect x="2" y="4" width="3" height="1"/><rect x="3" y="5" width="1" height="1"/></svg>`;
