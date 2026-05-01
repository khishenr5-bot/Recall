import { anthropic } from "@workspace/integrations-anthropic-ai";

export type IntentType =
  | "tool"
  | "roadmap"
  | "strategy"
  | "tutorial"
  | "resource"
  | "inspiration"
  | "general";

export interface ExtractedActions {
  intentType: IntentType;
  actions: string[];
}

export async function extractActionItems(
  title: string,
  bullets: string[]
): Promise<ExtractedActions> {
  const summary = `Title: ${title}\nKey points:\n- ${bullets.slice(0, 8).join("\n- ")}`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Analyze this article and extract concrete actionable items.

${summary}

Return JSON only (no markdown, no commentary):
{
  "intent_type": "tool" | "roadmap" | "strategy" | "tutorial" | "resource" | "inspiration",
  "actions": ["max 5 specific action strings, each starting with a verb like Install, Read, Try, Build, Set up, Apply, Review, Test, Schedule"]
}

If the article has no clear actions, return { "intent_type": "resource", "actions": [] }.`,
      },
    ],
  });

  const text = message.content[0]?.type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { intentType: "resource", actions: [] };
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const intent = String(parsed.intent_type || "resource").toLowerCase() as IntentType;
    const validIntents: IntentType[] = [
      "tool",
      "roadmap",
      "strategy",
      "tutorial",
      "resource",
      "inspiration",
    ];
    return {
      intentType: validIntents.includes(intent) ? intent : "resource",
      actions: Array.isArray(parsed.actions)
        ? parsed.actions.slice(0, 5).map((a: any) => String(a)).filter(Boolean)
        : [],
    };
  } catch {
    return { intentType: "resource", actions: [] };
  }
}

export interface WeeklyPlanTopAction {
  action: string;
  articleTitle?: string;
  rationale?: string;
}

export interface WeeklyPlan {
  topActions: WeeklyPlanTopAction[];
  insight: string;
}

const FALLBACK_PLAN: WeeklyPlan = {
  topActions: [],
  insight: "Save a few articles and we'll surface what to do this week.",
};

export async function generateActionPlan(
  goals: string,
  pendingActions: { action: string; intentType: string; sourceTitle: string }[]
): Promise<WeeklyPlan> {
  const actionList = pendingActions
    .slice(0, 40)
    .map((a, i) => `${i + 1}. [${a.intentType}] ${a.action} (from: ${a.sourceTitle})`)
    .join("\n");

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You help an indie operator turn saved articles into a real weekly action plan.

Their goals: ${goals || "(no goals set yet — pick balanced, generally useful actions)"}

Their pending actions from saved content:
${actionList || "(no pending actions yet)"}

Pick the THREE highest-leverage actions for this coming week, each ideally aligned with their goals if any.

Return JSON only (no markdown, no commentary):
{
  "top_actions": [
    { "action": "verb-first action under 12 words", "article_title": "exact source title or empty string", "rationale": "one short sentence why this matters now" }
  ],
  "insight": "one honest, observational sentence about their saving vs doing patterns"
}

Return at most 3 entries in top_actions. If there are no pending actions, return an empty top_actions array and an encouraging insight.`,
      },
    ],
  });

  const text = message.content[0]?.type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return FALLBACK_PLAN;
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const rawTop = Array.isArray(parsed.top_actions) ? parsed.top_actions : [];
    const topActions: WeeklyPlanTopAction[] = rawTop
      .slice(0, 3)
      .map((t: any) => ({
        action: String(t?.action ?? "").trim(),
        articleTitle: t?.article_title ? String(t.article_title) : undefined,
        rationale: t?.rationale ? String(t.rationale) : undefined,
      }))
      .filter((t: WeeklyPlanTopAction) => t.action.length > 0);
    return {
      topActions,
      insight: typeof parsed.insight === "string" ? parsed.insight : FALLBACK_PLAN.insight,
    };
  } catch {
    return FALLBACK_PLAN;
  }
}
