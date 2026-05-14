export type GuestbookEntry = {
  id: number;
  name: string;
  message: string;
  website: string | null;
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
  AVATAR_COLORS[seed % AVATAR_COLORS.length];
