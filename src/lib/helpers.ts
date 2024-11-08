export function trimText(input: string, maxLength: number = 100): string {
  if (input.length <= maxLength) return input;
  return input.substring(0, maxLength - 3) + "...";
}
export function getCurrentTimeInItaly(): Date {
  // Get the current time in Italy, accounting for DST automatically
  const nowInItaly = new Date().toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
  });
  return new Date(nowInItaly);
}

export function formatTimeTo12H(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    hour12: true, // Use 12-hour format with AM/PM
    timeZone: "Europe/Rome",
  };

  return new Intl.DateTimeFormat("en-US", options).format(date);
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
