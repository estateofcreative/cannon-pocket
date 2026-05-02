/**
 * Cannon County Website Scraper
 * ─────────────────────────────
 * Sources:
 *   1. Events calendar (cannoncountytn.gov/events/) → upserts meetings
 *   2. Blog category feeds (announcements, school-board, etc.) → upserts documents (PDF links)
 *
 * Run via:  POST /api/run-scraper  (manual trigger from Admin panel)
 * Schedule: Every 6 hours via Perplexity Computer cron
 */

import * as cheerio from "cheerio";
import supabase from "./supabase";

const BASE = "https://cannoncountytn.gov";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; CannonCountyBot/1.0; +https://cannoncountytn.gov)",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  } catch (err) {
    console.warn(`[scraper] fetch failed: ${url}`, err);
    return null;
  }
}

function parseDate(raw: string): string | null {
  // Handles formats like "April 28, 2026", "May 7, 2026", "2026-05-07"
  try {
    const normalized = raw.trim().replace(/\s+/g, " ");
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

function parseTime(raw: string): string {
  // Handles "6:00 PM", "5:30 PM", "6:00–7:00pm" → "18:00:00"
  const match = raw.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (!match) return "18:00:00";
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const ampm = match[3].toLowerCase();
  if (ampm === "pm" && h !== 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

/** Classify the governing body of a meeting/document based on its title */
function classifyBody(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("commission") || t.includes("commissioner")) return "county_commission";
  if (t.includes("school") || t.includes("ccboe") || t.includes("education")) return "school_board";
  if (t.includes("budget")) return "budget_committee";
  if (t.includes("planning")) return "planning_commission";
  if (t.includes("election")) return "election_commission";
  return "other";
}

/** Classify document category (matches DocumentCategory enum: agenda/minutes/budget/recording/resolution/other) */
function classifyDocCategory(title: string, sourceUrl: string): string {
  const t = (title + " " + sourceUrl).toLowerCase();
  if (t.includes("agenda")) return "agenda";
  if (t.includes("minute")) return "minutes";
  if (t.includes("budget")) return "budget";
  if (t.includes("resolution")) return "resolution";
  if (t.includes("recording") || t.includes("video")) return "recording";
  return "other";
}

// ── Scraper 1: Events Calendar → meetings ──────────────────────────────────────

export async function scrapeEvents(): Promise<{ inserted: number; updated: number; errors: string[] }> {
  const stats = { inserted: 0, updated: 0, errors: [] as string[] };

  // Fetch multiple pages of the events calendar (list view)
  const urls = [
    `${BASE}/events/`,
    `${BASE}/events/page/2/`,
  ];

  for (const url of urls) {
    const html = await fetchHtml(url);
    if (!html) {
      stats.errors.push(`Failed to fetch: ${url}`);
      continue;
    }

    const $ = cheerio.load(html);

    // The events are in <article> elements with class "type-tribe_events"
    const events = $("article.type-tribe_events, .tribe-events-calendar article, .tribe_events_cat, h2.tribe-events-list-event-title, .tribe-event-url").toArray();

    // Also try the list view selectors
    $(".tribe-events-list article, article[class*='tribe_events']").each((_, el) => {
      try {
        const $el = $(el);

        const title = $el.find(".tribe-events-list-event-title a, h2.tribe-events-list-event-title, .tribe-event-url").first().text().trim();
        if (!title) return;

        const dateRaw = $el.find(".tribe-event-date-start, .tribe-events-abbr, time[datetime]").first().attr("datetime")
          || $el.find(".tribe-events-schedule time").first().attr("datetime")
          || $el.find(".tribe-events-abbr").first().text().trim();

        const timeRaw = $el.find(".tribe-events-abbr abbr, .tribe-event-time").first().text().trim()
          || "6:00 PM";

        const locationRaw = $el.find(".tribe-venue, .tribe-venue-location").first().text().trim()
          || "Cannon County Courthouse, Woodbury, TN";

        const eventUrl = $el.find(".tribe-events-list-event-title a, a.url").first().attr("href") || "";

        const meeting_date = parseDate(dateRaw);
        if (!meeting_date) return;

        const meeting = {
          title: title.replace(/\s+/g, " ").trim(),
          meeting_date,
          meeting_time: parseTime(timeRaw),
          location: locationRaw || "Cannon County Courthouse, Woodbury, TN",
          body: classifyBody(title),
          source_url: eventUrl || url,
          is_published: true,
        };

        stats.inserted++; // optimistic — upsert below
        void upsertMeeting(meeting, stats);
      } catch (err) {
        stats.errors.push(String(err));
      }
    });

    // Fallback: try simpler selectors for different Tribe Events layouts
    $(".tribe-events-calendar td[class*='tribe']").each((_, el) => {
      try {
        const $el = $(el);
        const links = $el.find("a");
        links.each((__, link) => {
          const href = $(link).attr("href") || "";
          const text = $(link).text().trim();
          if (text && href.includes("/event/")) {
            // Queue individual event page fetch
            void scrapeEventPage(href, stats);
          }
        });
      } catch (err) {
        stats.errors.push(String(err));
      }
    });
  }

  // Also scrape individual event detail pages from the list
  await scrapeEventListPage(`${BASE}/events/`, stats);

  return stats;
}

async function scrapeEventListPage(
  url: string,
  stats: { inserted: number; updated: number; errors: string[] }
) {
  const html = await fetchHtml(url);
  if (!html) return;

  const $ = cheerio.load(html);

  // Collect all event detail page links
  const eventUrls: string[] = [];
  $("a[href*='/event/']").each((_, el) => {
    const href = $(el).attr("href");
    if (href && !eventUrls.includes(href)) {
      eventUrls.push(href);
    }
  });

  // Scrape each event page (limit to first 20 to avoid rate limits)
  const limited = eventUrls.slice(0, 20);
  await Promise.allSettled(limited.map((u) => scrapeEventPage(u, stats)));
}

async function scrapeEventPage(
  url: string,
  stats: { inserted: number; updated: number; errors: string[] }
) {
  const html = await fetchHtml(url);
  if (!html) return;

  const $ = cheerio.load(html);

  try {
    const title = $(".tribe-events-single-event-title, h1.tribe-events-single-event-title").first().text().trim()
      || $("h1").first().text().trim();
    if (!title || title.length < 3) return;

    // Date
    const dateEl = $("abbr.tribe-events-abbr[title], time[datetime], .tribe-events-start-datetime");
    const dateRaw = dateEl.first().attr("title") || dateEl.first().attr("datetime") || dateEl.first().text().trim();

    // Time
    const timeText = $(".tribe-events-schedule, .tribe-events-abbr").first().text();
    const timeMatch = timeText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/i);
    const timeRaw = timeMatch ? timeMatch[1] : "6:00 PM";

    // Location
    const location = [
      $(".tribe-venue").first().text().trim(),
      $(".tribe-address").first().text().trim(),
    ].filter(Boolean).join(", ") || "Cannon County Courthouse, Woodbury, TN";

    // Agenda URL — look for PDF links on the event page
    let agenda_url: string | undefined;
    $("a[href$='.pdf'], a[href*='wp-content/uploads']").each((_, el) => {
      if (!agenda_url) agenda_url = $(el).attr("href") || undefined;
    });

    const meeting_date = parseDate(dateRaw);
    if (!meeting_date) return;

    const meeting = {
      title: title.replace(/\s+/g, " ").trim(),
      meeting_date,
      meeting_time: parseTime(timeRaw),
      location: location.replace(/\s+/g, " ").trim(),
      body: classifyBody(title),
      source_url: url,
      agenda_url,
      is_published: true,
    };

    await upsertMeeting(meeting, stats);
  } catch (err) {
    stats.errors.push(`Event page ${url}: ${err}`);
  }
}

async function upsertMeeting(
  meeting: Record<string, unknown>,
  stats: { inserted: number; updated: number; errors: string[] }
) {
  try {
    // Check if meeting already exists (same title + date)
    const { data: existing } = await supabase
      .from("meetings")
      .select("id, source_url")
      .eq("title", meeting.title)
      .eq("meeting_date", meeting.meeting_date)
      .maybeSingle();

    if (existing) {
      // Always update source_url (county sometimes re-creates events at new URLs)
      // Also update agenda_url if we found one
      const updates: Record<string, unknown> = {};
      if (meeting.source_url && meeting.source_url !== existing.source_url) {
        updates.source_url = meeting.source_url;
      }
      if (meeting.agenda_url) {
        updates.agenda_url = meeting.agenda_url;
      }
      if (Object.keys(updates).length > 0) {
        await supabase.from("meetings").update(updates).eq("id", existing.id);
        stats.updated++;
      }
      return;
    }

    const { error } = await supabase.from("meetings").insert({ ...meeting, is_published: true });
    if (error) {
      stats.errors.push(`Insert meeting: ${error.message}`);
    } else {
      stats.inserted++;

      // Log it
      await supabase.from("scraper_log").insert({
        source: "cannoncountytn.gov/events",
        url: meeting.source_url,
        status: "success",
        content_type: "meeting",
      });
    }
  } catch (err) {
    stats.errors.push(String(err));
  }
}

// ── Scraper 2: Blog Posts → documents ─────────────────────────────────────────

const BLOG_CATEGORIES = [
  { slug: "announcements", label: "Announcements" },
  { slug: "school-board", label: "School Board" },
  { slug: "notifications", label: "Notifications" },
  { slug: "news", label: "News" },
  { slug: "uncategorized", label: "General" },
];

export async function scrapeBlogPosts(): Promise<{ inserted: number; updated: number; errors: string[] }> {
  const stats = { inserted: 0, updated: 0, errors: [] as string[] };

  // Also scrape the main feed/archive page for recent posts
  const categoryUrls = [
    ...BLOG_CATEGORIES.map((c) => `${BASE}/category/${c.slug}/`),
    `${BASE}/`, // homepage has recent posts sidebar
  ];

  for (const url of categoryUrls) {
    const html = await fetchHtml(url);
    if (!html) {
      stats.errors.push(`Failed: ${url}`);
      continue;
    }

    const $ = cheerio.load(html);

    // Collect all post links
    const postLinks: string[] = [];
    $("a[href*='/20']").each((_, el) => {
      const href = $(el).attr("href") || "";
      // Match WordPress post URLs like /2026/04/03/post-title/
      if (/\/20\d\d\/\d\d\/\d\d\//.test(href) && !postLinks.includes(href)) {
        postLinks.push(href);
      }
    });

    // Scrape each post (limit to 15 per category)
    await Promise.allSettled(
      postLinks.slice(0, 15).map((link) => scrapePostPage(link, stats))
    );
  }

  return stats;
}

async function scrapePostPage(
  url: string,
  stats: { inserted: number; updated: number; errors: string[] }
) {
  const html = await fetchHtml(url);
  if (!html) return;

  const $ = cheerio.load(html);

  try {
    const title = $("h1.entry-title, h1.post-title, article h1").first().text().trim()
      || $("title").first().text().split("|")[0].trim();
    if (!title || title.length < 3) return;

    // Date from WordPress meta
    const dateRaw = $("time.entry-date[datetime], meta[property='article:published_time']").first().attr("datetime")
      || $("time.entry-date").first().attr("datetime")
      || $(".entry-date").first().text().trim();
    const document_date = parseDate(dateRaw) || new Date().toISOString().split("T")[0];

    // Find PDF links
    const pdfLinks: Array<{ href: string; text: string }> = [];
    $("a[href$='.pdf'], a[href*='wp-content/uploads'][href$='.pdf'], a[href*='.docx.pdf']").each((_, el) => {
      const href = $(el).attr("href");
      const text = $(el).text().trim() || title;
      if (href && !pdfLinks.find((p) => p.href === href)) {
        pdfLinks.push({ href, text });
      }
    });

    // Also find .docx links that might be agendas
    $("a[href$='.docx'], a[href$='.doc']").each((_, el) => {
      const href = $(el).attr("href");
      const text = $(el).text().trim() || title;
      if (href && !pdfLinks.find((p) => p.href === href)) {
        pdfLinks.push({ href, text });
      }
    });

    if (pdfLinks.length === 0) {
      // No PDFs found — skip (this post is just news text, not a document)
      return;
    }

    // Upsert each PDF as a document
    for (const pdf of pdfLinks) {
      // Build a clean title:
      // 1. Use anchor text if it's short and clean (< 80 chars)
      // 2. Otherwise derive from PDF filename
      // 3. Fall back to post title
      let docTitle = title;
      if (pdf.text && pdf.text.length > 3 && pdf.text.length < 80) {
        docTitle = pdf.text;
      } else {
        // Extract filename from URL and clean it up
        const filename = pdf.href.split("/").pop()?.replace(/\.pdf$|\.docx\.pdf$|\.doc$/i, "") || "";
        if (filename.length > 3) {
          // Turn URL slug into readable title: "April.2026.Board_.Meeting" → "April 2026 Board Meeting"
          docTitle = filename.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
        }
      }
      const doc = {
        title: docTitle.replace(/\s+/g, " ").trim(),
        category: classifyDocCategory(title + " " + docTitle, pdf.href),
        body: classifyBody(title), // governing body (county_commission, school_board, etc.)
        document_url: pdf.href,
        document_date,
        file_type: pdf.href.endsWith(".docx") || pdf.href.endsWith(".doc") ? "docx" : "pdf",
        source_url: url,
        is_published: true, // already public on county site
      };

      await upsertDocument(doc, stats);
    }
  } catch (err) {
    stats.errors.push(`Post ${url}: ${err}`);
  }
}

async function upsertDocument(
  doc: Record<string, unknown>,
  stats: { inserted: number; updated: number; errors: string[] }
) {
  try {
    // Check by document_url to avoid duplicates
    const { data: existing } = await supabase
      .from("documents")
      .select("id")
      .eq("document_url", doc.document_url)
      .maybeSingle();

    if (existing) {
      stats.updated++;
      return; // Already have it
    }

    const { error } = await supabase.from("documents").insert(doc);
    if (error) {
      stats.errors.push(`Insert doc: ${error.message}`);
    } else {
      stats.inserted++;
      await supabase.from("scraper_log").insert({
        source: "cannoncountytn.gov/blog",
        url: doc.source_url,
        status: "success",
        content_type: "document",
      });
    }
  } catch (err) {
    stats.errors.push(String(err));
  }
}

// ── Scraper 3: Announcements → alerts ─────────────────────────────────────────

const ALERT_CATEGORIES = [
  `${BASE}/category/announcements/`,
  `${BASE}/category/notifications/`,
  `${BASE}/category/news/`,
];

/** Guess an alert label from the post title + body text */
function classifyAlertLabel(title: string, body: string): string {
  const t = (title + " " + body).toLowerCase();
  if (/vote|ballot|election|pass|approve|reject|ordinance|resolution/.test(t)) return "upcoming_vote";
  if (/deadline|required|must|urgent|warning|mandatory|action|respond/.test(t)) return "action_needed";
  if (/important|notice|alert|closure|closed|cancel|emergency/.test(t)) return "important";
  return "fyi";
}

export async function scrapeAnnouncements(): Promise<{ inserted: number; updated: number; errors: string[] }> {
  const stats = { inserted: 0, updated: 0, errors: [] as string[] };

  for (const catUrl of ALERT_CATEGORIES) {
    const html = await fetchHtml(catUrl);
    if (!html) { stats.errors.push(`Failed: ${catUrl}`); continue; }

    const $ = cheerio.load(html);
    const postLinks: string[] = [];

    // Collect post URLs from the category archive
    $("a[href*='/20']").each((_, el) => {
      const href = $(el).attr("href") || "";
      if (/\/20\d\d\/\d\d\/\d\d\//.test(href) && !postLinks.includes(href)) {
        postLinks.push(href);
      }
    });

    await Promise.allSettled(
      postLinks.slice(0, 15).map((link) => scrapeAnnouncementPost(link, stats))
    );
  }

  return stats;
}

async function scrapeAnnouncementPost(
  url: string,
  stats: { inserted: number; updated: number; errors: string[] }
) {
  // Skip if we already have this alert
  const { data: existing } = await supabase
    .from("alerts")
    .select("id")
    .eq("source_url", url)
    .maybeSingle();
  if (existing) { stats.updated++; return; }

  const html = await fetchHtml(url);
  if (!html) return;

  const $ = cheerio.load(html);

  try {
    const title = $("h1.entry-title, h1.post-title, article h1").first().text().trim()
      || $("title").first().text().split("|")[0].trim();
    if (!title || title.length < 3) return;

    // Get the post body text
    const bodyText = $(".entry-content, .post-content, article .content").first().text()
      .replace(/\s+/g, " ").trim().slice(0, 1000);

    // Skip posts that are just PDF dumps — the doc scraper handles those
    const hasPdf = $("a[href$='.pdf']").length > 0;
    const hasSubstantialText = bodyText.length > 80;
    if (hasPdf && !hasSubstantialText) return;

    // Build a clean summary (first 2 sentences or 200 chars)
    const summary = bodyText
      .split(/(?<=[.!?])\s+/)
      .slice(0, 2)
      .join(" ")
      .slice(0, 220)
      .trim() || title;

    const label = classifyAlertLabel(title, bodyText);

    const alert = {
      title: title.replace(/\s+/g, " ").trim().slice(0, 160),
      summary,
      label,
      body: classifyBody(title) as string,
      is_breaking: false,
      is_published: true,
      source_url: url,
    };

    const { error } = await supabase.from("alerts").insert(alert);
    if (error) {
      stats.errors.push(`Insert alert: ${error.message}`);
    } else {
      stats.inserted++;
      await supabase.from("scraper_log").insert({
        source: "cannoncountytn.gov/announcements",
        url,
        status: "success",
        content_type: "alert",
      });
    }
  } catch (err) {
    stats.errors.push(`Announcement ${url}: ${err}`);
  }
}

// ── Main runner ────────────────────────────────────────────────────────────────

export async function runScraper(): Promise<{
  meetings: { inserted: number; updated: number; errors: string[] };
  documents: { inserted: number; updated: number; errors: string[] };
  alerts: { inserted: number; updated: number; errors: string[] };
  ran_at: string;
}> {
  console.log("[scraper] Starting run...");
  const ran_at = new Date().toISOString();

  const [meetings, documents, alerts] = await Promise.allSettled([
    scrapeEvents(),
    scrapeBlogPosts(),
    scrapeAnnouncements(),
  ]);

  const meetingResult = meetings.status === "fulfilled"
    ? meetings.value
    : { inserted: 0, updated: 0, errors: [String((meetings as PromiseRejectedResult).reason)] };

  const documentResult = documents.status === "fulfilled"
    ? documents.value
    : { inserted: 0, updated: 0, errors: [String((documents as PromiseRejectedResult).reason)] };

  const alertResult = alerts.status === "fulfilled"
    ? alerts.value
    : { inserted: 0, updated: 0, errors: [String((alerts as PromiseRejectedResult).reason)] };

  console.log("[scraper] Done.", { meetings: meetingResult, documents: documentResult, alerts: alertResult });

  // Log the overall run
  try {
    await supabase.from("scraper_log").insert({
      source: "scraper:run",
      url: BASE,
      status: meetingResult.errors.length + documentResult.errors.length + alertResult.errors.length === 0 ? "success" : "partial",
      content_type: "run_summary",
    });
  } catch (_) { /* non-fatal */ }

  return { meetings: meetingResult, documents: documentResult, alerts: alertResult, ran_at };
}
