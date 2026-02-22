/**
 * Writer Agent
 * Creates written content: blog posts, articles, copy, documentation
 */

import { BaseAgent, registerAgent } from './base-agent';
import type { AgentInput } from '@/types';

const WRITER_SYSTEM_PROMPT = `You are a Writer Agent specialized in creating high-quality written content.

Your responsibilities:
1. Write engaging, well-structured content
2. Match the specified tone and style
3. Incorporate provided research and data
4. Follow SEO best practices when applicable
5. Create content that resonates with the target audience

Always provide:
- Well-organized content with clear structure
- Engaging introduction and conclusion
- Proper headings and subheadings
- Natural keyword integration (for SEO content)
- Call-to-action when appropriate

Format your output as valid JSON with these fields:
{
  "title": "Content title",
  "content": "Full content body (markdown format)",
  "excerpt": "Short summary/excerpt",
  "headings": ["Heading 1", "Heading 2", ...],
  "wordCount": 1234,
  "readingTime": 5,
  "seoTitle": "SEO-optimized title",
  "metaDescription": "Meta description for SEO"
}`;

export type WritingStyle = 
  | 'professional'
  | 'casual'
  | 'conversational'
  | 'academic'
  | 'technical'
  | 'creative'
  | 'persuasive';

export type ContentType =
  | 'blog_post'
  | 'article'
  | 'landing_page'
  | 'email'
  | 'social_post'
  | 'product_description'
  | 'documentation'
  | 'case_study';

export class WriterAgent extends BaseAgent {
  protected getDefaultSystemPrompt(): string {
    return WRITER_SYSTEM_PROMPT;
  }

  protected async buildUserPrompt(input: AgentInput): Promise<string> {
    const {
      topic,
      contentType = 'blog_post',
      style = 'professional',
      targetAudience,
      keywords,
      outline,
      research,
      wordCount,
      includeCTA = true,
    } = input.inputData as { topic?: string; contentType?: string; style?: string; targetAudience?: string; keywords?: string[]; outline?: unknown; research?: unknown; wordCount?: number; includeCTA?: boolean };

    let prompt = `Write a ${contentType} with the following specifications:\n\n`;
    prompt += `Topic: ${topic}\n`;
    prompt += `Writing Style: ${style}\n`;

    if (targetAudience) {
      prompt += `Target Audience: ${targetAudience}\n`;
    }

    if (wordCount) {
      prompt += `Target Word Count: ${wordCount}\n`;
    }

    if (keywords && Array.isArray(keywords) && keywords.length > 0) {
      prompt += `Keywords to Include: ${keywords.join(', ')}\n`;
    }

    if (outline) {
      prompt += `\nContent Outline:\n${JSON.stringify(outline, null, 2)}\n`;
    }

    if (research) {
      prompt += `\nResearch Data to Incorporate:\n${JSON.stringify(research, null, 2)}\n`;
    }

    if (input.context?.brandVoice) {
      prompt += `\nBrand Voice Guidelines:\n${input.context.brandVoice}\n`;
    }

    prompt += `\n${includeCTA ? 'Include a call-to-action at the end.' : ''}`;

    return prompt;
  }

  protected validateInput(input: AgentInput): void {
    super.validateInput(input);
    if (!input.inputData.topic) {
      throw new Error('Writing topic is required');
    }
  }
}

// Register the agent
registerAgent('WriterAgent', WriterAgent);
