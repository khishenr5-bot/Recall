import { anthropic } from "@workspace/integrations-anthropic-ai";

export async function generateSummary(content: string, title: string, preferredLanguage = "en"): Promise<{
  verdict: string;
  bullets: string[];
  recallScore: number;
  credibilityScore: number;
  credibilityVerdict: string;
  language: string;
}> {
  const langInstruction = preferredLanguage !== "en"
    ? `IMPORTANT: Generate the verdict and bullets in ${preferredLanguage} language.`
    : "";

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `You are Recall.ai's intelligence engine. Analyze this article and return a structured JSON response.

Title: ${title}
Content (first 8000 chars): ${content.slice(0, 8000)}

${langInstruction}

Return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{
  "verdict": "1-2 sentence verdict on whether this is worth reading and why",
  "bullets": ["key insight 1", "key insight 2", "key insight 3"],
  "recallScore": 7,
  "credibilityScore": 8,
  "credibilityVerdict": "Brief credibility assessment",
  "language": "en"
}

Rules:
- verdict: Honest, direct assessment of the content's value (1-3 sentences)
- bullets: 3-8 key insights, each a complete, standalone sentence. More bullets for deeper content.
- recallScore: 1-10 based on originality, depth, and information density
- credibilityScore: 1-10 based on source quality, factual accuracy, and bias
- credibilityVerdict: One sentence assessment of source credibility
- language: ISO 639-1 code of the content language (or preferred language if specified)`
      }
    ]
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse AI response");

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    verdict: parsed.verdict ?? "Unable to generate verdict.",
    bullets: Array.isArray(parsed.bullets) ? parsed.bullets : [],
    recallScore: Math.min(10, Math.max(1, Number(parsed.recallScore) || 5)),
    credibilityScore: Math.min(10, Math.max(1, Number(parsed.credibilityScore) || 5)),
    credibilityVerdict: parsed.credibilityVerdict ?? "",
    language: parsed.language ?? "en",
  };
}

export async function generateSuggestedQuestions(title: string, verdict: string, bullets: string[]): Promise<string[]> {
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `Generate 3 insightful follow-up questions about this article.

Title: ${title}
Verdict: ${verdict}
Key Points: ${bullets.join(" | ")}

Return ONLY a JSON array of 3 question strings, no explanation:
["question 1?", "question 2?", "question 3?"]`
      }
    ]
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (!arrMatch) return ["What are the main implications of this?", "How does this relate to current trends?", "What should I do with this information?"];
  try {
    return JSON.parse(arrMatch[0]).slice(0, 3);
  } catch {
    return ["What are the main implications of this?", "How does this relate to current trends?", "What should I do with this information?"];
  }
}

export async function askQuestion(question: string, context: { title: string; verdict: string; bullets: string[]; articleText?: string | null }): Promise<{ answer: string; citations: { title: string }[] }> {
  const contentStr = context.articleText
    ? `Title: ${context.title}\nVerdict: ${context.verdict}\nKey Points:\n${context.bullets.map((b, i) => `${i + 1}. ${b}`).join("\n")}\n\nFull Text: ${context.articleText.slice(0, 6000)}`
    : `Title: ${context.title}\nVerdict: ${context.verdict}\nKey Points:\n${context.bullets.map((b, i) => `${i + 1}. ${b}`).join("\n")}`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `Answer this question based on the article content below.

Question: ${question}

Article Content:
${contentStr}

Provide a clear, direct answer based only on the content provided. If the content doesn't address the question, say so.`
      }
    ]
  });

  const answer = message.content[0].type === "text" ? message.content[0].text : "Unable to answer.";
  return { answer, citations: [{ title: context.title }] };
}

export async function askLibraryQuestion(question: string, articles: Array<{ id: number; title: string; verdict: string; bullets: string[] }>): Promise<{ answer: string; citations: { title: string; id: number | null }[] }> {
  const libraryContext = articles.slice(0, 20).map(a =>
    `Article: "${a.title}"\nVerdict: ${a.verdict}\nKey Points: ${a.bullets.slice(0, 3).join(" | ")}`
  ).join("\n\n---\n\n");

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `You are an AI assistant with access to a user's reading library. Answer their question by synthesizing insights from their saved articles.

Question: ${question}

Library Articles:
${libraryContext}

Provide a comprehensive answer citing specific articles where relevant. Be specific and actionable.`
      }
    ]
  });

  const answer = message.content[0].type === "text" ? message.content[0].text : "Unable to answer.";
  const citations = articles.slice(0, 5).map(a => ({ title: a.title, id: a.id }));
  return { answer, citations };
}

export async function generateRabbitHole(title: string, verdict: string, bullets: string[]): Promise<Array<{ title: string; description: string; searchQuery: string }>> {
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `Based on this article, suggest 5 related topics to explore next.

Article: ${title}
Verdict: ${verdict}
Key Points: ${bullets.join(" | ")}

Return ONLY a JSON array of 5 objects, no explanation:
[
  {"title": "Topic title", "description": "Why this is worth exploring", "searchQuery": "search terms to find this"},
  ...
]`
      }
    ]
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (!arrMatch) return [];
  try {
    return JSON.parse(arrMatch[0]).slice(0, 5);
  } catch {
    return [];
  }
}

export async function generateReadingDna(articles: Array<{ title: string; verdict: string; createdAt: Date }>): Promise<{
  topicBreakdown: Array<{ topic: string; count: number; percentage: number }>;
  mostActiveDay: string;
  preferredContentType: string;
  avgSessionLength: number;
}> {
  if (articles.length === 0) {
    return {
      topicBreakdown: [],
      mostActiveDay: "N/A",
      preferredContentType: "Articles",
      avgSessionLength: 0,
    };
  }

  const titlesStr = articles.slice(0, 30).map(a => a.title).join(", ");

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `Analyze these article titles and identify reading patterns.

Articles: ${titlesStr}

Return ONLY JSON, no explanation:
{
  "topics": [
    {"topic": "Technology", "count": 5},
    {"topic": "Science", "count": 3}
  ]
}

Extract 4-7 distinct topic categories.`
      }
    ]
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  let topics: Array<{ topic: string; count: number }> = [];
  try {
    const parsed = JSON.parse(jsonMatch?.[0] ?? "{}");
    topics = Array.isArray(parsed.topics) ? parsed.topics : [];
  } catch {
    topics = [{ topic: "General", count: articles.length }];
  }

  const total = topics.reduce((sum, t) => sum + t.count, 0) || 1;
  const topicBreakdown = topics.map(t => ({
    topic: t.topic,
    count: t.count,
    percentage: Math.round((t.count / total) * 100),
  }));

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const dayCounts = new Array(7).fill(0);
  articles.forEach(a => {
    dayCounts[new Date(a.createdAt).getDay()]++;
  });
  const maxDayIdx = dayCounts.indexOf(Math.max(...dayCounts));
  const mostActiveDay = days[maxDayIdx] ?? "Monday";

  return {
    topicBreakdown,
    mostActiveDay,
    preferredContentType: "Articles",
    avgSessionLength: Math.min(30, Math.max(5, articles.length * 2)),
  };
}

export async function generateFlashcards(title: string, verdict: string, bullets: string[]): Promise<Array<{ front: string; back: string }>> {
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 4096,
    messages: [{
      role: "user",
      content: `Create 8 flashcards from this article. Each flashcard tests a key concept.

Title: ${title}
Verdict: ${verdict}
Key Points: ${bullets.join(" | ")}

Return ONLY a JSON array of 8 objects, no explanation:
[{"front": "Question or concept prompt?", "back": "Clear, concise answer"}, ...]`
    }]
  });
  const text = message.content[0].type === "text" ? message.content[0].text : "[]";
  const match = text.match(/\[[\s\S]*\]/);
  try { return JSON.parse(match?.[0] ?? "[]").slice(0, 8); } catch { return []; }
}

export async function generateQuiz(title: string, verdict: string, bullets: string[]): Promise<Array<{ question: string; options: string[]; correctIndex: number; explanation: string }>> {
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 4096,
    messages: [{
      role: "user",
      content: `Create 5 multiple choice questions from this article.

Title: ${title}
Verdict: ${verdict}
Key Points: ${bullets.join(" | ")}

Return ONLY a JSON array of 5 objects, no explanation:
[{"question": "Question text?", "options": ["A", "B", "C", "D"], "correctIndex": 0, "explanation": "Brief explanation of why this is correct"}, ...]`
    }]
  });
  const text = message.content[0].type === "text" ? message.content[0].text : "[]";
  const match = text.match(/\[[\s\S]*\]/);
  try { return JSON.parse(match?.[0] ?? "[]").slice(0, 5); } catch { return []; }
}

export async function generateInfographic(title: string, verdict: string, bullets: string[]): Promise<{
  title: string; subtitle: string;
  sections: Array<{ heading: string; points: string[] }>;
  keyStat: string; bottomLine: string;
}> {
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: `Create an infographic layout for this article.

Title: ${title}
Verdict: ${verdict}
Key Points: ${bullets.join(" | ")}

Return ONLY JSON, no explanation:
{"title": "Short punchy title", "subtitle": "One-line subtitle", "sections": [{"heading": "Section name", "points": ["point 1", "point 2"]}, ...], "keyStat": "One striking statistic or fact", "bottomLine": "One-sentence takeaway"}`
    }]
  });
  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  const match = text.match(/\{[\s\S]*\}/);
  try {
    const p = JSON.parse(match?.[0] ?? "{}");
    return { title: p.title ?? title, subtitle: p.subtitle ?? verdict, sections: p.sections ?? [], keyStat: p.keyStat ?? "", bottomLine: p.bottomLine ?? "" };
  } catch {
    return { title, subtitle: verdict, sections: [], keyStat: "", bottomLine: "" };
  }
}

export async function generateSlides(title: string, verdict: string, bullets: string[], instructions?: string): Promise<Array<{ slideNumber: number; layout: string; title: string; content: string | string[]; speakerNotes: string }>> {
  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 4096,
    messages: [{
      role: "user",
      content: `Create an 8-slide presentation for this article.${instructions ? ` Custom instructions: ${instructions}` : ""}

Title: ${title}
Verdict: ${verdict}
Key Points: ${bullets.join(" | ")}

Layouts available: "title" (large centered text), "content" (title + bullets), "two_column" (title + two arrays), "quote" (title + single quote), "stats" (title + stat highlights)

Return ONLY a JSON array, no explanation:
[{"slideNumber": 1, "layout": "title", "title": "Title text", "content": "Subtitle or quote text", "speakerNotes": "What to say"}, ...]`
    }]
  });
  const text = message.content[0].type === "text" ? message.content[0].text : "[]";
  const match = text.match(/\[[\s\S]*\]/);
  try { return JSON.parse(match?.[0] ?? "[]").slice(0, 10); } catch { return []; }
}

export async function generateDeepResearch(question: string, articles: Array<{ id: number; title: string; verdict: string; bullets: string[] }>): Promise<{
  subQuestions: string[];
  relevantArticles: Array<{ id: number; title: string; relevance: string }>;
  searchQueries: string[];
  synthesis: string;
}> {
  const libraryCtx = articles.slice(0, 15).map(a =>
    `[ID:${a.id}] "${a.title}": ${a.bullets.slice(0, 2).join(". ")}`
  ).join("\n");

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{
      role: "user",
      content: `Perform deep research on this question using the user's library.

Question: ${question}

User's Library:
${libraryCtx || "No articles saved yet."}

Return ONLY JSON, no explanation:
{
  "subQuestions": ["sub-question 1", "sub-question 2", "sub-question 3"],
  "relevantArticles": [{"id": 1, "title": "Article title", "relevance": "Why this is relevant"}],
  "searchQueries": ["google search 1", "google search 2", "google search 3"],
  "synthesis": "Comprehensive 3-5 paragraph synthesis answer"
}`
    }]
  });
  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  const match = text.match(/\{[\s\S]*\}/);
  try {
    const p = JSON.parse(match?.[0] ?? "{}");
    return {
      subQuestions: p.subQuestions ?? [],
      relevantArticles: p.relevantArticles ?? [],
      searchQueries: p.searchQueries ?? [],
      synthesis: p.synthesis ?? "",
    };
  } catch {
    return { subQuestions: [], relevantArticles: [], searchQueries: [], synthesis: "Unable to synthesize research." };
  }
}

export async function generateMentorRecommendations(articles: Array<{ title: string; verdict: string }>): Promise<{
  knowledgeGaps: Array<{ topic: string; description: string; suggestedReads: string[] }>;
  insights: string;
}> {
  if (articles.length === 0) {
    return {
      knowledgeGaps: [
        { topic: "Get Started", description: "Start saving articles to get personalized recommendations.", suggestedReads: [] }
      ],
      insights: "Save more articles to unlock personalized AI mentor recommendations.",
    };
  }

  const titlesStr = articles.slice(0, 20).map(a => a.title).join(", ");

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `Based on this reading history, identify 3 knowledge gaps and provide mentor recommendations.

Reading history: ${titlesStr}

Return ONLY JSON, no explanation:
{
  "knowledgeGaps": [
    {
      "topic": "Topic name",
      "description": "Why this is a gap and why it matters",
      "suggestedReads": ["Article title 1", "Article title 2"]
    }
  ],
  "insights": "Overall insight about the reader's knowledge pattern in 2 sentences"
}`
      }
    ]
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  try {
    return JSON.parse(jsonMatch?.[0] ?? "{}");
  } catch {
    return {
      knowledgeGaps: [],
      insights: "Keep reading to get personalized insights.",
    };
  }
}
