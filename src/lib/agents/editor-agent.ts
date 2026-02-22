/**
 * Editor Agent
 * Reviews and edits content: grammar, style, clarity, consistency
 */

import { BaseAgent, registerAgent } from './base-agent';
import type { AgentInput } from '@/types';

const EDITOR_SYSTEM_PROMPT = `You are an Editor Agent specialized in reviewing and improving written content.

Your responsibilities:
1. Check grammar, spelling, and punctuation
2. Improve clarity and readability
3. Ensure consistent tone and style
4. Verify factual accuracy (flag potential issues)
5. Optimize flow and structure
6. Suggest improvements for engagement

Always provide:
- Edited version of the content
- Summary of changes made
- List of issues found and fixed
- Suggestions for further improvement
- Quality score (1-10)

Format your output as valid JSON with these fields:
{
  "editedContent": "Full edited content (markdown format)",
  "editedTitle": "Edited title if changed",
  "changesSummary": "Brief summary of edits made",
  "issuesFound": [{"type": "grammar|style|clarity|factual", "original": "...", "suggestion": "...", "explanation": "..."}],
  "improvementSuggestions": ["Suggestion 1", ...],
  "qualityScore": 8,
  "readabilityScore": 65,
  "toneAnalysis": "Description of the tone"
}`;

export type EditType =
  | 'proofread'      // Basic grammar and spelling
  | 'copyedit'       // Style and clarity
  | 'substantive'    // Deep structural edits
  | 'seo'           // SEO optimization
  | 'technical'      // Technical accuracy;

export class EditorAgent extends BaseAgent {
  protected getDefaultSystemPrompt(): string {
    return EDITOR_SYSTEM_PROMPT;
  }

  protected async buildUserPrompt(input: AgentInput): Promise<string> {
    const {
      content,
      title,
      editType = 'copyedit',
      styleGuide,
      targetAudience,
      focusAreas,
      preserveVoice = true,
    } = input.inputData as { content?: string; title?: string; editType?: string; styleGuide?: unknown; targetAudience?: string; focusAreas?: string[]; preserveVoice?: boolean };

    let prompt = `Edit the following content:\n\n`;
    prompt += `Edit Type: ${editType}\n`;

    if (title) {
      prompt += `Title: ${title}\n`;
    }

    prompt += `\n--- CONTENT START ---\n${content}\n--- CONTENT END ---\n\n`;

    if (styleGuide) {
      prompt += `Style Guide Requirements:\n${JSON.stringify(styleGuide, null, 2)}\n\n`;
    }

    if (targetAudience) {
      prompt += `Target Audience: ${targetAudience}\n\n`;
    }

    if (focusAreas && Array.isArray(focusAreas) && focusAreas.length > 0) {
      prompt += `Focus Areas: ${focusAreas.join(', ')}\n\n`;
    }

    prompt += preserveVoice 
      ? 'Maintain the original voice and tone while making improvements.\n' 
      : 'Feel free to significantly rewrite for better clarity and engagement.\n';

    if (input.context?.previousEdits) {
      prompt += `\nPrevious Edit Notes:\n${JSON.stringify(input.context.previousEdits, null, 2)}\n`;
    }

    return prompt;
  }

  protected validateInput(input: AgentInput): void {
    super.validateInput(input);
    if (!input.inputData.content) {
      throw new Error('Content to edit is required');
    }
  }
}

// Register the agent
registerAgent('EditorAgent', EditorAgent);
