import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const modelos = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: "./src/data/modelos",
  }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    model: z.string(),
    preview: z.string().optional(),
  }),
});

const landing = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: "./src/data/landing",
  }),
  schema: z.object({
    title_en: z.string(),
    title_es: z.string(),
    description_en: z.string(),
    description_es: z.string(),
    fundraising_goal_en: z.string(),
    fundraising_goal_es: z.string(),
    cta_text_en: z.string(),
    cta_text_es: z.string(),
    cta_url: z.string(),
    footer_text_en: z.string(),
    footer_text_es: z.string(),
  }),
});

export const collections = { modelos, landing };