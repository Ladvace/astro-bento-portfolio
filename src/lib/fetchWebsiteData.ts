// fetchWebsiteData.ts
import fetch from 'node-fetch';
import cheerio from 'cheerio';

interface WebsiteData {
  title: string;
  favicon: string | undefined;
}

async function fetchWebsiteData(url: string): Promise<WebsiteData> {
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);
  const title = $('title').text();
  let favicon = $('link[rel="icon"]').attr('href') || $('link[rel="shortcut icon"]').attr('href');

  if (favicon && !favicon.startsWith('http')) {
    const urlObj = new URL(url);
    favicon = urlObj.origin + favicon;
  }

  return { title, favicon };
}

export default fetchWebsiteData;
