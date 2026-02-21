/**
 * SEO Agent
 * Performs SEO analysis and optimization: keywords, meta tags, content optimization
 */

import { BaseAgent, registerAgent } from './base-agent';
import type { AgentInput } from '@/types';

const SEO_SYSTEM_PROMPT = `You are an SEO Agent specialized in search engine optimization.

Your responsibilities:
1. Analyze content for SEO opportunities
2. Research and recommend keywords
3. Optimize meta tags and descriptions
4. Improve content structure for search engines
5. Identify technical SEO issues
6. Provide actionable SEO recommendations

Always provide:
- Keyword analysis and recommendations
- Optimized meta title and description
- Content optimization suggestions
- Internal/external linking recommendations
- Technical SEO checklist
- Competitor insights (when data available)

Format your output as valid JSON with these fields:
{
  "seoScore": 75,
  "keywordAnalysis": {
    "primaryKeyword": "main keyword",
    "secondaryKeywords": ["keyword1", "keyword2"],
    "keywordDensity": 2.5,
    "recommendations": ["Suggestion 1", ...]
  },
  "metaTags": {
    "title": "Optimized title (50-60 chars)",
    "description": "Optimized description (150-160 chars)",
    "ogTitle": "Open Graph title",
    "ogDescription": "Open Graph description",
    "twitterCard": "summary_large_image"
  },
  "contentOptimization": {
    "wordCount": 1500,
    "readabilityScore": 65,
    "headingStructure": ["H1", "H2", "H2", "H3"],
    "improvements": [{"section": "...", "suggestion": "...", "priority": "high|medium|low"}]
  },
  "technicalSeo": {
    "urlSlug": "optimized-url-slug",
    "canonicalUrl": "suggested canonical",
    "schemaMarkup": {"@type": "...", ...},
    "checklist": [{"item": "...", "status": "pass|fail|warning"}]
  },
  "linkRecommendations": {
    "internalLinks": [{"anchor": "...", "target": "..."}],
    "externalLinks": [{"anchor": "...", "url": "...", "reason": "..."}]
  }
}`;

export class SeoAgent extends BaseAgent {
  protected getDefaultSystemPrompt(): string {
    return SEO_SYSTEM_PROMPT;
  }

  protected async buildUserPrompt(input: AgentInput): Promise<string> {
    const {
      content,
      title,
      targetKeywords,
      targetAudience,
      competitors,
      analysisType = 'full',
    } = input.inputData;

    let prompt = `Perform SEO analysis with the following parameters:\n\n`;
    prompt += `Analysis Type: ${analysisType}\n`;

    if (title) {
      prompt += `Content Title: ${title}\n`;
    }

    if (targetKeywords && Array.isArray(targetKeywords) && targetKeywords.length > 0) {
      prompt += `Target Keywords: ${targetKeywords.join(', ')}\n`;
    }

    if (targetAudience) {
      prompt += `Target Audience: ${targetAudience}\n`;
    }

    if (content) {
      prompt += `\n--- CONTENT TO ANALYZE ---\n${content.substring(0, 10000)}${content.length > 10000 ? '...' : ''}\n--- CONTENT END ---\n`;
    }

    if (competitors && Array.isArray(competitors) && competitors.length > 0) {
      prompt += `\nCompetitor URLs to analyze:\n${competitors.join('\n')}\n`;
    }

    if (input.context?.websiteInfo) {
      prompt += `\nWebsite Context:\n${JSON.stringify(input.context.websiteInfo, null, 2)}\n`;
    }

    if (input.context?.previousSeoAudit) {
      prompt += `\nPrevious SEO Audit:\n${JSON.stringify(input.context.previousSeoAudit, null, 2)}\n`;
    }

    prompt += `\nProvide comprehensive SEO analysis and recommendations.`;

    return prompt;
  }

  protected validateInput(input: AgentInput): void {
    super.validateInput(input);
    if (!input.inputData.content && !input.inputData.url) {
      throw new Error('Either content or URL is required for SEO analysis');
    }
  }
}

// Register the agent
registerAgent('SeoAgent', SeoAgent);
