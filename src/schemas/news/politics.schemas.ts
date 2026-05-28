import { z } from "zod";

// ─── Date Range ───────────────────────────────────────────────────────────────

export type DateRangePreset = "today" | "yesterday" | "week";

/**
 * Validates the query parameters for the politics news endpoint.
 * Callers must supply either a `generalRange` preset OR a custom `from`/`to`
 * date range — never both.
 */
export const getPoliticsNewsQuerySchema = z.union([
  z.object({
    generalRange: z.enum(["today", "yesterday", "week"]),
    from: z.undefined(),
    to: z.undefined(),
  }),
  z.object({
    generalRange: z.undefined(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "from must be YYYY-MM-DD"),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "to must be YYYY-MM-DD"),
  }),
]);

export type GetPoliticsNewsQuery = z.infer<typeof getPoliticsNewsQuerySchema>;

// ─── OpenAI Response Shapes ───────────────────────────────────────────────────

export const politicsNewsItemSchema = z
  .object({
    title: z.string().min(1),
    summary: z.string().min(1),
    sources: z
      .array(z.string().min(1))
      .min(3)
      .refine(
        (sources) => !sources.some((source) => /wikipedia/i.test(source)),
        "sources must not include wikipedia"
      ),
  })
  .strict();

export type PoliticsNewsItem = z.infer<typeof politicsNewsItemSchema>;

export const politicsNewsBatchSchema = z
  .object({
    name: z.string(),
    usNews: z.array(politicsNewsItemSchema).min(10).max(10),
  })
  .strict();

export type PoliticsNewsBatch = z.infer<typeof politicsNewsBatchSchema>;

