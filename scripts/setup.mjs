import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const repoRoot = process.cwd();

const defaults = {
  site: { url: "https://gianmarcocavallo.com/" },
  author: {
    firstName: "Gianmarco",
    lastName: "Cavallo",
    fullName: "Gianmarco Cavallo",
    shortName: "Gianmarco",
    jobTitle: "Freelance Full Stack Developer",
    twitterHandle: "gianmarcocavallo", // without "@"
  },
  location: {
    countryName: "Italy",
    countryCode: "IT",
    timezone: "Europe/Rome",
  },
  links: {
    github: "https://github.com/Ladvace",
    linkedin: "https://www.linkedin.com/in/gianmarco-cavallo/",
    medium: "https://ladvace.medium.com/",
    discord: "https://discordapp.com/users/163300027618295808",
    dribble: "https://dribbble.com/Ladvace_Jace",
    email: "contact@gianmarcocavallo.com",
  },
  cal: {
    username: "ladvace",
    durationNamespace: "15min",
    origin: "https://cal.com",
  },
  visitedCountries: [
    "France",
    "China",
    "Italy",
    "Sri Lanka",
    "Uzbekistan",
    "Turkey",
    "Greece",
    "Malta",
    "Hungary",
    "Portugal",
    "Morocco",
    "Greece",
    "Spain",
    "Netherlands",
    "Belgium",
    "Spain",
  ],
};

function toCsvArray(value) {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function generateSiteConfigFile(siteConfig) {
  return `export const SITE = ${JSON.stringify(siteConfig, null, 2)};\n`;
}

async function updateDotEnv(envPath, updates) {
  let current = "";
  if (existsSync(envPath)) current = await readFile(envPath, "utf8");

  const lines = current.length ? current.split(/\r?\n/) : [];
  const seen = new Set();

  const updatedLines = lines.map((line) => {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) return line;

    const key = m[1];
    if (!(key in updates)) return line;

    seen.add(key);
    return `${key}=${updates[key]}`;
  });

  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) updatedLines.push(`${key}=${value}`);
  }

  await writeFile(envPath, updatedLines.filter((l) => l !== undefined).join("\n") + "\n", "utf8");
}

async function main() {
  const r = readline.createInterface({ input, output });
  const askOnce = async (q, defaultValue) => {
    const prompt = defaultValue ? `${q} [${defaultValue}]: ` : `${q}: `;
    const answer = (await r.question(prompt)).trim();
    return answer.length ? answer : defaultValue;
  };

  const siteUrl = await askOnce("Site URL (used for sitemap/robots)", defaults.site.url);
  const fullName = await askOnce("Author full name", defaults.author.fullName);
  const firstName = await askOnce("Author first name", defaults.author.firstName);
  const lastName = await askOnce("Author last name", defaults.author.lastName);
  const jobTitle = await askOnce("Job title (schema + card title)", defaults.author.jobTitle);
  const countryName = await askOnce("Country name", defaults.location.countryName);
  const countryCode = await askOnce("Country code (2 letters)", defaults.location.countryCode);
  const timezone = await askOnce("Timezone (IANA)", defaults.location.timezone);
  const twitterHandle = await askOnce("Twitter handle (without @)", defaults.author.twitterHandle);
  const email = await askOnce("Contact email", defaults.links.email);

  const github = await askOnce("GitHub URL", defaults.links.github);
  const linkedin = await askOnce("LinkedIn URL", defaults.links.linkedin);
  const medium = await askOnce("Medium URL", defaults.links.medium);
  const discord = await askOnce("Discord URL", defaults.links.discord);
  const dribble = await askOnce("Dribbble URL", defaults.links.dribble);

  const calUsername = await askOnce("Cal.com username (data-cal-link)", defaults.cal.username);
  const calNamespace = await askOnce(
    "Cal.com duration namespace (Cal.ns[...])",
    defaults.cal.durationNamespace
  );

  const visitedCountriesCsv = await askOnce(
    "Visited countries (comma-separated)",
    defaults.visitedCountries.join(", ")
  );

  const siteConfig = {
    site: { url: siteUrl },
    author: {
      firstName,
      lastName,
      fullName,
      shortName: firstName,
      jobTitle,
      twitterHandle,
    },
    location: {
      countryName,
      countryCode,
      timezone,
    },
    links: {
      github,
      linkedin,
      medium,
      discord,
      dribble,
      email,
    },
    cal: {
      username: calUsername,
      durationNamespace: calNamespace,
      origin: defaults.cal.origin,
    },
    visitedCountries: toCsvArray(visitedCountriesCsv),
  };

  const siteConfigPath = path.join(repoRoot, "src", "site-config.ts");
  await writeFile(siteConfigPath, generateSiteConfigFile(siteConfig), "utf8");

  const envPath = path.join(repoRoot, ".env");
  await updateDotEnv(envPath, { SITE_URL: siteUrl });

  r.close();

  // eslint-disable-next-line no-console
  console.log("Setup complete.");
  // eslint-disable-next-line no-console
  console.log("Next: run `pnpm dev`.");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

