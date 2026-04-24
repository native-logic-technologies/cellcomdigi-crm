// Web Scraping Service
// Uses jina.ai reader API (free, no auth) as primary scraper
// Falls back to basic fetch + DOM parser if jina fails

const JINA_READER_HTTPS = 'https://r.jina.ai/https://';

// Configurable CORS proxy. Users can set their own in production.
const CORS_PROXY =
  (import.meta as any).env?.VITE_CORS_PROXY ||
  'https://api.allorigins.win/raw?url=';

export interface ScrapedPage {
  url: string;
  title: string;
  content: string;
  source: 'jina' | 'fallback';
}

function normalizeUrl(url: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return 'https://' + url;
  }
  return url;
}

/**
 * Fetch a URL, falling back to a CORS proxy on network/CORS errors.
 * Returns the raw response so XML/HTML parsers still work.
 */
async function fetchWithCorsFallback(url: string, init?: RequestInit): Promise<Response> {
  // Try direct fetch first
  try {
    const res = await fetch(url, init);
    if (res.ok) return res;
    // If server returned 4xx/5xx, still try proxy (might be geo-blocked)
  } catch {
    // CORS or network error — fall through to proxy
  }

  // Try CORS proxy
  const proxyUrl = CORS_PROXY + encodeURIComponent(url);
  const proxyRes = await fetch(proxyUrl, init);
  if (!proxyRes.ok) {
    throw new Error(`Proxy failed: ${proxyRes.status}`);
  }
  return proxyRes;
}

/**
 * Scrape a single URL using jina.ai reader API.
 * Returns clean article text without ads/nav/scripts.
 */
export async function scrapeUrl(url: string): Promise<ScrapedPage> {
  const normalized = normalizeUrl(url);

  // Try jina.ai first
  const jinaUrl = normalized.replace(/^https?:\/\//, JINA_READER_HTTPS);
  try {
    const res = await fetch(jinaUrl, {
      headers: { 'Accept': 'text/plain' },
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const text = await res.text();
      const lines = text.split('\n').filter(l => l.trim());
      const title = lines[0]?.replace(/^Title:\s*/i, '') || normalized;
      const content = lines.slice(1).join('\n').trim();
      return { url: normalized, title, content, source: 'jina' };
    }
  } catch {
    // Fall through
  }

  // Fallback: direct fetch + basic extraction
  return fallbackScrape(normalized);
}

async function fallbackScrape(url: string): Promise<ScrapedPage> {
  const res = await fetchWithCorsFallback(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }

  const html = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const title = doc.querySelector('title')?.textContent || url;

  // Remove script/style/nav/footer tags
  const removeTags = ['script', 'style', 'nav', 'footer', 'header', 'aside', 'noscript'];
  for (const tag of removeTags) {
    doc.querySelectorAll(tag).forEach(el => el.remove());
  }

  // Try to find main content area
  const main =
    doc.querySelector('main') ||
    doc.querySelector('article') ||
    doc.querySelector('[role="main"]') ||
    doc.querySelector('.content') ||
    doc.querySelector('#content') ||
    doc.body;

  let content = '';
  if (main) {
    // Get text from paragraphs and headings
    const textEls = main.querySelectorAll('p, h1, h2, h3, h4, li');
    const chunks: string[] = [];
    textEls.forEach(el => {
      const text = el.textContent?.trim();
      if (text && text.length > 20) {
        chunks.push(text);
      }
    });
    content = chunks.join('\n\n');
  }

  if (!content || content.length < 200) {
    // Last resort: all body text
    content = doc.body?.textContent?.replace(/\s+/g, ' ').trim() || '';
  }

  return { url, title, content, source: 'fallback' };
}

/**
 * Fetch and parse a sitemap.xml.
 * Returns array of URLs found.
 */
export async function parseSitemap(sitemapUrl: string): Promise<string[]> {
  const normalized = normalizeUrl(sitemapUrl);
  const res = await fetchWithCorsFallback(normalized, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    throw new Error(`Failed to fetch sitemap: ${res.status}`);
  }

  const xml = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');

  // Check for parse error
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid XML in sitemap');
  }

  const urls: string[] = [];
  const locElements = doc.querySelectorAll('url > loc, sitemap > loc');
  locElements.forEach(el => {
    const text = el.textContent?.trim();
    if (text) urls.push(text);
  });

  return [...new Set(urls)]; // dedupe
}
