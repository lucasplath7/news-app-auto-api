import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { streamStructuredResponse } from "../../utils/streamStructuredResponse.js";
import { toDateRangeString } from "../../utils/dateHelpers.js";
import {
  getPoliticsNewsQuerySchema,
  politicsNewsItemSchema,
  politicsNewsBatchSchema,
} from "../../schemas/news/politics.schemas.js";
import type { GetPoliticsNewsQuery } from "../../schemas/news/politics.schemas.js";

// ─── Prompt Builder ───────────────────────────────────────────────────────────

function buildPrompt(query: GetPoliticsNewsQuery): string {
  const dateRange = query.generalRange
    ? toDateRangeString(query.generalRange)
    : `${query.from} to ${query.to}`;
  return `Summarize the top 7 most significant United States political news stories from ${dateRange}.`;
}

// ─── Controller ───────────────────────────────────────────────────────────────

export const getPoliticsNewsController = asyncHandler(
  async (req: Request<{}, {}, {}, GetPoliticsNewsQuery>, res: Response) => {
    const validatedQuery = getPoliticsNewsQuerySchema.parse(req.query);
    const userPrompt = buildPrompt(validatedQuery);

    await streamStructuredResponse(req, res, {
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a Harvard history professor with a focus on American politics." +
            " You are skilled at summarizing news stories from a variety of reputable sources.",
        },
        {
          role: "developer",
          content:
            "When you answer, respond ONLY in the specified JSON format." +
            " Summaries should be 5-10 sentences in order to provide adequate detail." +
            " For each story, verify using at least 3 reputable news sources and list the sources used." +
            " Do not use the same source more than once for the same story." +
            " Do not use wikipedia as a source.",
        },
        { role: "user", content: userPrompt },
      ],
      batchSchema: politicsNewsBatchSchema,
      batchSchemaName: "politics_news_batch",
      itemSchema: politicsNewsItemSchema,
      arrayProperty: "usNews",
      tools: [{ type: "web_search" }],
      cacheKey: `politics_news_${JSON.stringify(validatedQuery)}`,
      clientOptions: { timeout: undefined },
    });
  }
);
