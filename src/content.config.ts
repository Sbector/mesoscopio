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
    model: z.string(), // 🔥 ruta al .glb
  }),
});

export const collections = { modelos };