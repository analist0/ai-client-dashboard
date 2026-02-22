/**
 * Research Agent
 * Performs research tasks: gathers information, analyzes topics, finds sources
 */

import { BaseAgent, registerAgent } from './base-agent';
import type { AgentInput } from '@/types';

const RESEARCH_SYSTEM_PROMPT = `You are a Research Agent specialized in gathering and analyzing information.

Your responsibilities:
1. Research the given topic thoroughly
2. Find relevant facts, statistics, and data points
3. Identify key sources and references
4. Analyze trends and patterns
5. Summarize findings in a structured format

Always provide:
- Key findings (3-5 main points)
- Supporting data/evidence
- Sources (when applicable)
- Related topics worth exploring
- Potential angles or perspectives

Format your output as valid JSON with these fields:
{
  "summary": "Brief overview of research findings",
  "keyFindings": ["Finding 1", "Finding 2", ...],
  "dataPoints": [{"label": "...", "value": "..."}],
  "sources": [{"title": "...", "url": "...", "relevance": "..."}],
  "relatedTopics": ["Topic 1", "Topic 2", ...],
  "recommendations": ["Recommendation 1", ...]
}`;

export class ResearchAgent extends BaseAgent {
  protected getDefaultSystemPrompt(): string {
    return RESEARCH_SYSTEM_PROMPT;
  }

  protected async buildUserPrompt(input: AgentInput): Promise<string> {
    const inputData = input.inputData as { topic?: unknown; keywords?: unknown; depth?: unknown; excludeSources?: string[] };
    const { topic, keywords, depth = 'comprehensive', excludeSources = [] } = inputData;

    let prompt = `Research Topic: ${topic}\n\n`;

    if (keywords && Array.isArray(keywords) && keywords.length > 0) {
      prompt += `Focus Keywords: ${keywords.join(', ')}\n\n`;
    }

    prompt += `Research Depth: ${depth}\n\n`;

    if (excludeSources.length > 0) {
      prompt += `Exclude these sources: ${excludeSources.join(', ')}\n\n`;
    }

    if (input.context?.previousResearch) {
      prompt += `\nPrevious Research Context:\n${JSON.stringify(input.context.previousResearch, null, 2)}\n\n`;
    }

    prompt += `Provide comprehensive research findings based on the above topic.`;

    return prompt;
  }

  protected validateInput(input: AgentInput): void {
    super.validateInput(input);
    if (!input.inputData.topic) {
      throw new Error('Research topic is required');
    }
  }
}

// Register the agent
registerAgent('ResearchAgent', ResearchAgent);
