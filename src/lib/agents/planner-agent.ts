/**
 * Planner Agent
 * Creates project plans, task breakdowns, and execution strategies
 */

import { BaseAgent, registerAgent } from './base-agent';
import type { AgentInput } from '@/types';

const PLANNER_SYSTEM_PROMPT = `You are a Planner Agent specialized in creating project plans and task breakdowns.

Your responsibilities:
1. Break down complex projects into manageable tasks
2. Estimate time and resources required
3. Identify dependencies between tasks
4. Recommend optimal task sequencing
5. Assign appropriate AI agents to tasks
6. Create realistic timelines and milestones

Always provide:
- Detailed task breakdown
- Time estimates for each task
- Task dependencies
- Recommended agent assignments
- Risk assessment
- Milestone definitions

Format your output as valid JSON with these fields:
{
  "projectPlan": {
    "summary": "Project overview",
    "objectives": ["Objective 1", ...],
    "phases": [{"name": "...", "tasks": [...], "duration": "X days"}]
  },
  "tasks": [{
    "name": "Task name",
    "description": "Task description",
    "type": "blog_post|research|seo|dev|design|etc",
    "estimatedHours": 4,
    "priority": 5,
    "dependencies": ["task_id_1"],
    "assignedAgent": "ResearchAgent|WriterAgent|etc",
    "inputRequirements": {"key": "value"},
    "expectedOutput": "Description of expected output"
  }],
  "timeline": {
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "milestones": [{"name": "...", "date": "...", "tasks": [...]}]
  },
  "resources": {
    "requiredAgents": ["Agent1", "Agent2"],
    "estimatedCost": 100,
    "notes": "Additional resource notes"
  },
  "risks": [{"description": "...", "probability": "low|medium|high", "mitigation": "..."}]
}`;

export class PlannerAgent extends BaseAgent {
  protected getDefaultSystemPrompt(): string {
    return PLANNER_SYSTEM_PROMPT;
  }

  protected async buildUserPrompt(input: AgentInput): Promise<string> {
    const {
      projectName,
      projectDescription,
      objectives,
      taskType,
      complexity = 'medium',
      deadline,
      budget,
      preferences,
    } = input.inputData as { projectName?: string; projectDescription?: string; objectives?: string[]; taskType?: string; complexity?: string; deadline?: string; budget?: unknown; preferences?: unknown };

    let prompt = `Create a project plan with the following specifications:\n\n`;
    prompt += `Project Name: ${projectName}\n`;
    prompt += `Project Description: ${projectDescription}\n`;

    if (objectives && Array.isArray(objectives) && objectives.length > 0) {
      prompt += `Objectives:\n${objectives.map((o: string) => `- ${o}`).join('\n')}\n`;
    }

    if (taskType) {
      prompt += `Primary Task Type: ${taskType}\n`;
    }

    prompt += `Complexity Level: ${complexity}\n`;

    if (deadline) {
      prompt += `Deadline: ${deadline}\n`;
    }

    if (budget) {
      prompt += `Budget: ${budget}\n`;
    }

    if (preferences) {
      prompt += `\nPreferences/Constraints:\n${JSON.stringify(preferences, null, 2)}\n`;
    }

    if (input.context?.similarProjects) {
      prompt += `\nSimilar Past Projects:\n${JSON.stringify(input.context.similarProjects, null, 2)}\n`;
    }

    if (input.context?.clientPreferences) {
      prompt += `\nClient Preferences:\n${JSON.stringify(input.context.clientPreferences, null, 2)}\n`;
    }

    prompt += `\nCreate a comprehensive project plan with detailed task breakdown.`;

    return prompt;
  }

  protected validateInput(input: AgentInput): void {
    super.validateInput(input);
    if (!input.inputData.projectName) {
      throw new Error('Project name is required');
    }
  }
}

// Register the agent
registerAgent('PlannerAgent', PlannerAgent);
