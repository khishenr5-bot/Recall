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
  } catch {
    // Fallback: direct fetch
    try {
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
    } catch {
      throw new Error(`Failed to fetch content from URL: ${url}`);
    }
  }
}

function isYouTubeUrl(url: string): boolean {
  return url.includes("youtube.com/watch") || url.includes("youtu.be/");
}

async function scrapeYouTube(url: string): Promise<ScrapedContent> {
  const videoId = extractYouTubeId(url);
  if (!videoId) throw new Error("Invalid YouTube URL");

  const youtubeApiKey = process.env.YOUTUBE_API_KEY;

  // Use YouTube Data API v3 if key is available
  if (youtubeApiKey) {
    try {
      const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${youtubeApiKey}&part=snippet,contentDetails,statistics`;
      const apiResponse = await fetch(apiUrl, {
        signal: AbortSignal.timeout(10000),
      });

      if (apiResponse.ok) {
        const data = await apiResponse.json() as {
          items?: Array<{
            snippet?: {
              title?: string;
              description?: string;
              channelTitle?: string;
              tags?: string[];
              publishedAt?: string;
            };
            contentDetails?: { duration?: string };
            statistics?: { viewCount?: string; likeCount?: string };
          }>;
        };

        const item = data.items?.[0];
        if (item?.snippet) {
          const { title = "", description = "", channelTitle = "", tags = [], publishedAt = "" } = item.snippet;
          const { viewCount = "0", likeCount = "0" } = item.statistics ?? {};
          const duration = item.contentDetails?.duration ?? "";

          const content = [
            `YouTube Video: ${title}`,
            `Channel: ${channelTitle}`,
            `Published: ${publishedAt}`,
            `Duration: ${duration}`,
            `Views: ${viewCount} | Likes: ${likeCount}`,
            tags.length > 0 ? `Tags: ${tags.slice(0, 10).join(", ")}` : "",
            "",
            "Description:",
            description.slice(0, 8000),
          ].filter(Boolean).join("\n");

          return {
            title: title || `YouTube: ${videoId}`,
            content,
            sourceType: "youtube",
          };
        }
      }
    } catch {
      // Fall through to Jina
    }
  }

  // Fallback: Use Jina Reader to get video page content
  try {
    const jinaUrl = `https://r.jina.ai/https://www.youtube.com/watch?v=${videoId}`;
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
  } catch {
    // Last resort fallback
  }

  return {
    title: `YouTube Video: ${videoId}`,
    content: `YouTube video ID: ${videoId}. URL: ${url}`,
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
