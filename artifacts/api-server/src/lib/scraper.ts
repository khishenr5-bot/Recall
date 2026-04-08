export type ScrapedContent = {
  title: string;
  content: string;
  sourceType: "url" | "youtube";
};

export async function scrapeUrl(url: string): Promise<ScrapedContent> {
  // Check if YouTube URL
  if (isYouTubeUrl(url)) {
    return scrapeYouTube(url);
  }

  // Use Jina Reader as primary scraper
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const response = await fetch(jinaUrl, {
      headers: {
        "Accept": "text/plain",
        "X-Return-Format": "text",
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Jina Reader failed: ${response.status}`);
    }

    const text = await response.text();
    const title = extractTitle(text, url);

    return {
      title,
      content: text.slice(0, 50000),
      sourceType: "url",
    };
  } catch (err) {
    // Fallback: direct fetch
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RecallBot/1.0)",
      },
      signal: AbortSignal.timeout(15000),
    });
    const html = await response.text();
    const content = stripHtml(html);
    const title = extractHtmlTitle(html) || extractTitle(content, url);

    return {
      title,
      content: content.slice(0, 50000),
      sourceType: "url",
    };
  }
}

function isYouTubeUrl(url: string): boolean {
  return url.includes("youtube.com/watch") || url.includes("youtu.be/");
}

async function scrapeYouTube(url: string): Promise<ScrapedContent> {
  const videoId = extractYouTubeId(url);
  if (!videoId) throw new Error("Invalid YouTube URL");

  // Use Jina to get video description and transcript
  const jinaUrl = `https://r.jina.ai/${url}`;
  const response = await fetch(jinaUrl, {
    headers: { "Accept": "text/plain" },
    signal: AbortSignal.timeout(30000),
  });

  if (response.ok) {
    const text = await response.text();
    return {
      title: extractTitle(text, url) || `YouTube: ${videoId}`,
      content: text.slice(0, 50000),
      sourceType: "youtube",
    };
  }

  return {
    title: `YouTube Video: ${videoId}`,
    content: `YouTube video at: ${url}`,
    sourceType: "youtube",
  };
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match?.[1] ?? null;
}

function extractTitle(text: string, url: string): string {
  const lines = text.split("\n").filter(l => l.trim().length > 10);
  if (lines.length > 0) {
    const firstLine = lines[0].replace(/^#+\s*/, "").trim();
    if (firstLine.length > 5 && firstLine.length < 200) {
      return firstLine;
    }
  }
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace("www.", "");
  } catch {
    return "Article";
  }
}

function extractHtmlTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim() ?? null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
