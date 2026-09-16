import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			tags: z.array(z.string()).optional(),
			// 원본(비공개 작업 저장소) 기준 최초 작성 시각. 분 단위까지 있으면
			// 표시 측에서 시각을 함께 노출한다. 문자열을 Date로 변환.
			created_at: z.coerce.date(),
			// 원본 기준 마지막 수정 시각. created_at과 다를 때만 "수정"으로 표시.
			updated_at: z.coerce.date().optional(),
			heroImage: z.optional(image()),
		}),
});

export const collections = { blog };
