import { z } from "zod";
import {
  Highlight,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  HighlightField,
} from "../types/highlight.types.js";

// Define highlight schema
export const highlightSchema: z.ZodType<Highlight> = z.object({
  pre_tags: z.array(z.string()).optional(),
  post_tags: z.array(z.string()).optional(),
  fields: z.record(
    z.string(),
    z
      .object({
        fragment_size: z.number().optional(),
        number_of_fragments: z.number().optional(),
      })
      .optional(),
  ),
});
