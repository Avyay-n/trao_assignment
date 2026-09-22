import * as cheerio from "cheerio";
import { RobotsParser } from "./robots.js";

export interface CrawlPage {
  url: string;
  title: string;
  text: string;
  isHiringPage: boolean;
  score: number;
}

export interface CrawlResult {
  pages: CrawlPage[];
  pagesUsed: string[];
  hiringPageFound: boolean;
  notes: string[];
  error?: string;
}

export interface CrawlerOptions {
  allowLocalUrls?: boolean;
  timeoutMs?: number;
  maxPages?: number;
  maxRetries?: number;
}

const HIRING_KEYWORDS: Record<string, number> = {
  "interview": 100,
  "hiring": 95,
  "careers": 90,
  "jobs": 85,
  "handbook": 80,
  "engineering-culture": 75,
  "culture": 65,
  "work-with-us": 65,
  "join-us": 65,
  "team": 50,
  "about": 45,
  "values": 40,
  "engineering": 40,
  "people": 35,
  "company": 30,
};

/**
 * Validates URLs against SSRF vulnerabilities while supporting local addresses when enabled.
 */
export function validateUrl(rawUrl: string, allowLocal: boolean = true): { valid: boolean; error?: string; parsed?: URL } {
  try {
    const parsed = new URL(rawUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { valid: false, error: `Invalid protocol: ${parsed.protocol}. Only HTTP and HTTPS are permitted.` };
    }

    const host = parsed.hostname.toLowerCase();

    // Check for private / loopback IP addresses if local URLs are strictly disabled
    if (!allowLocal) {
      if (
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "::1" ||
        host.startsWith("10.") ||
        host.startsWith("192.168.") ||
        host.startsWith("172.16.") ||
        host.startsWith("169.254.")
      ) {
        return { valid: false, error: "Access to private or loopback addresses is restricted in production." };
      }
    }

    return { valid: true, parsed };
  } catch (err: any) {
    return { valid: false, error: `Malformed URL: ${rawUrl}` };
  }
}

/**
 * Strips HTML noise and produces clean, readable text.
 */
export function cleanHtml(html: string, maxChars: number = 8000): { title: string; text: string } {
  const $ = cheerio.load(html);

  // Extract title before stripping
  const title = $("title").first().text().trim() || $("h1").first().text().trim() || "";

  // Remove elements irrelevant for hiring context
  $("script, style, noscript, svg, nav, footer, iframe, link, meta, form, [aria-hidden='true']").remove();

  // Extract text from main content or body
  const mainContent = $("main, article, #content, .content, .main").first();
  const rawText = mainContent.length > 0 ? mainContent.text() : $("body").text();

  // Clean whitespace
  const text = rawText
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim()
    .slice(0, maxChars);

  return { title, text };
}

/**
 * Scores and ranks discovered URLs to identify the most promising hiring or company information.
 */
export function scoreLink(href: string, text: string): number {
  const normalized = (href + " " + text).toLowerCase();
  let score = 0;

  for (const [kw, weight] of Object.entries(HIRING_KEYWORDS)) {
    if (normalized.includes(kw)) {
      score += weight;
    }
  }

  // Penalty for common noise
  if (normalized.includes("privacy") || normalized.includes("terms") || normalized.includes("cookie")) {
    score -= 100;
  }
  if (normalized.includes("login") || normalized.includes("signup") || normalized.includes("cart")) {
    score -= 80;
  }

  return score;
}

/**
 * Fetches an HTTP URL with timeout and exponential backoff.
 */
export async function fetchWithRetry(
  url: string,
  timeoutMs: number = 8000,
  maxRetries: number = 2
): Promise<{ ok: boolean; status: number; text: string; error?: string }> {
  let attempt = 0;
  let delay = 500;

  while (attempt <= maxRetries) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "TraoInterviewPrepBot/1.0 (+https://github.com/trao-ai)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      clearTimeout(timer);

      if (response.ok) {
        const text = await response.text();
        return { ok: true, status: response.status, text };
      }

      // If 404, don't retry, it won't magically appear
      if (response.status === 404) {
        return { ok: false, status: 404, text: "", error: `HTTP 404 Not Found at ${url}` };
      }

      // If rate limited (429) or 5xx, wait and retry
      if (response.status === 429 || response.status >= 500) {
        attempt++;
        if (attempt <= maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }
      }

      return { ok: false, status: response.status, text: "", error: `HTTP error ${response.status}` };
    } catch (err: any) {
      clearTimeout(timer);
      attempt++;
      if (attempt <= maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      const isTimeout = err.name === "AbortError";
      return {
        ok: false,
        status: isTimeout ? 408 : 0,
        text: "",
        error: isTimeout ? `Request timed out after ${timeoutMs}ms` : (err.message || "Network request failed"),
      };
    }
  }

  return { ok: false, status: 0, text: "", error: "Maximum retries exceeded" };
}

/**
 * Intelligent web crawler for company information and hiring processes.
 */
export async function crawlCompanySite(
  companyUrl: string,
  options: CrawlerOptions = {}
): Promise<CrawlResult> {
  const allowLocal = options.allowLocalUrls ?? (process.env.ALLOW_LOCAL_URLS !== "false");
  const timeoutMs = options.timeoutMs ?? 8000;
  const maxPages = options.maxPages ?? 4;
  const maxRetries = options.maxRetries ?? 2;

  const urlValidation = validateUrl(companyUrl, allowLocal);
  if (!urlValidation.valid || !urlValidation.parsed) {
    return {
      pages: [],
      pagesUsed: [],
      hiringPageFound: false,
      notes: [`Invalid URL provided: ${companyUrl}. ${urlValidation.error || ""}`],
      error: urlValidation.error,
    };
  }

  const baseOrigin = urlValidation.parsed.origin;
  const pages: CrawlPage[] = [];
  const pagesUsed: string[] = [];
  const notes: string[] = [];

  // 1. Fetch robots.txt if available
  let robotsParser = new RobotsParser();
  try {
    const robotsUrl = new URL("/robots.txt", baseOrigin).toString();
    const robotsRes = await fetchWithRetry(robotsUrl, 3000, 1);
    if (robotsRes.ok && robotsRes.text) {
      robotsParser = new RobotsParser(robotsRes.text);
      notes.push("Retrieved and applied robots.txt rules.");
    }
  } catch {
    // Non-fatal if robots.txt is missing
  }

  // 2. Fetch Homepage
  const targetUrl = urlValidation.parsed.toString();
  if (!robotsParser.isAllowed(urlValidation.parsed.pathname)) {
    notes.push(`Homepage crawling blocked by robots.txt: ${targetUrl}`);
    return {
      pages: [],
      pagesUsed: [],
      hiringPageFound: false,
      notes,
    };
  }

  notes.push(`Fetching root page: ${targetUrl}`);
  const homeRes = await fetchWithRetry(targetUrl, timeoutMs, maxRetries);

  if (!homeRes.ok) {
    notes.push(`Could not reach ${targetUrl}: ${homeRes.error}`);
    return {
      pages: [],
      pagesUsed: [],
      hiringPageFound: false,
      notes,
      error: homeRes.error,
    };
  }

  const homeClean = cleanHtml(homeRes.text);
  pages.push({
    url: targetUrl,
    title: homeClean.title,
    text: homeClean.text,
    isHiringPage: false,
    score: 10,
  });
  pagesUsed.push(targetUrl);

  // 3. Extract and Rank Links
  const $ = cheerio.load(homeRes.text);
  const candidateLinks: { url: string; text: string; score: number }[] = [];
  const seenUrls = new Set<string>([targetUrl]);

  $("a[href]").each((_, el) => {
    const rawHref = $(el).attr("href")?.trim();
    const linkText = $(el).text().trim();
    if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("javascript:")) {
      return;
    }

    try {
      const resolved = new URL(rawHref, targetUrl);
      // Stay on same domain or subdomain
      if (resolved.origin === baseOrigin && !seenUrls.has(resolved.toString())) {
        if (robotsParser.isAllowed(resolved.pathname)) {
          const score = scoreLink(resolved.pathname, linkText);
          if (score > 15) {
            seenUrls.add(resolved.toString());
            candidateLinks.push({
              url: resolved.toString(),
              text: linkText,
              score,
            });
          }
        }
      }
    } catch {
      // Ignore invalid href
    }
  });

  // Sort candidates by score descending
  candidateLinks.sort((a, b) => b.score - a.score);

  // 4. Crawl top candidate links
  let hiringPageFound = false;
  const linksToCrawl = candidateLinks.slice(0, maxPages - 1);

  for (const candidate of linksToCrawl) {
    notes.push(`Fetching high-ranking link (score ${candidate.score}): ${candidate.url}`);
    const res = await fetchWithRetry(candidate.url, timeoutMs, 1);
    if (res.ok && res.text) {
      const clean = cleanHtml(res.text);
      const isHiring = candidate.score >= 50 || clean.text.toLowerCase().includes("interview") || clean.text.toLowerCase().includes("hiring process");
      if (isHiring) hiringPageFound = true;

      pages.push({
        url: candidate.url,
        title: clean.title,
        text: clean.text,
        isHiringPage: isHiring,
        score: candidate.score,
      });
      pagesUsed.push(candidate.url);
    } else {
      notes.push(`Skipped candidate link ${candidate.url}: ${res.error || "Failed"}`);
    }
  }

  return {
    pages,
    pagesUsed,
    hiringPageFound,
    notes,
  };
}
