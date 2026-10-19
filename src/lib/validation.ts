import { z } from "zod";

export const registrationSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(10).max(128),
  username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/),
  displayName: z.string().trim().min(1).max(60),
});

export const workSchema = z.object({
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().max(2000),
  visibility: z.enum(["public", "unlisted", "private"]),
});

export const chapterSchema = z.object({
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(100_000),
  publish: z.enum(["draft", "published"]),
});
