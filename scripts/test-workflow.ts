#!/usr/bin/env tsx
/**
 * Test Workflow - Validates AI Client Dashboard core functionality
 * Run with: npm run test:workflow (or tsx scripts/test-workflow.ts)
 *
 * Tests workflow definitions, agent registry data, utility functions,
 * type enumerations, and locale file completeness WITHOUT making
 * real API calls to Supabase or LLM providers.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// =====================================================
// TEST HARNESS
// =====================================================

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void | boolean): void {
  try {
    const result = fn();
    if (result === false) throw new Error('Assertion failed');
    console.log(`  ${GREEN}pass${RESET} ${name}`);
    passed++;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ${RED}FAIL${RESET} ${name}: ${msg}`);
    failed++;
    failures.push(`${name}: ${msg}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, label?: string): void {
  if (actual !== expected) {
    throw new Error(
      `${label ? label + ': ' : ''}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

async function suite(name: string, fn: () => void | Promise<void>): Promise<void> {
  console.log(`\n${BLUE}${BOLD}--- ${name}${RESET}`);
  await fn();
}

// =====================================================
// PROJECT ROOT
// =====================================================

const ROOT = join(import.meta.dirname ?? process.cwd(), '..');

// =====================================================
// LOAD SOURCE DATA DIRECTLY (no @/ alias in tsx scripts)
// We read/parse the TS source files as data rather than
// trying to import modules that depend on Next.js aliases.
// =====================================================

// --- Workflow definitions (parse the exported object) ---

const workflowSource = readFileSync(
  join(ROOT, 'src/lib/workflows/default-workflows.ts'),
  'utf-8'
);

// --- Helpers (import directly via relative path) ---
// The helpers module uses clsx + tailwind-merge which are
// available in node_modules. We dynamically import it via
// an absolute path after we resolve it.

const helpersPath = join(ROOT, 'src/lib/utils/helpers.ts');

// --- Locale files ---
const messagesDir = join(ROOT, 'messages');

// --- Types source ---
const typesSource = readFileSync(join(ROOT, 'src/types/index.ts'), 'utf-8');

// =====================================================
// HELPER: extract array of object-literal names from TS source
// =====================================================

function extractWorkflowKeys(source: string): string[] {
  // Matches keys inside `defaultWorkflows: Record<...> = { key1: ..., key2: ... }`
  const match = source.match(/export const defaultWorkflows[\s\S]*?=\s*\{([\s\S]*?)\};/);
  if (!match) return [];
  const body = match[1];
  const keys: string[] = [];
  const re = /(\w+)\s*:/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    keys.push(m[1]);
  }
  return keys;
}

function extractExportedWorkflowNames(source: string): string[] {
  const names: string[] = [];
  const re = /export const (\w+Workflow)\s*:\s*WorkflowDefinition/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    names.push(m[1]);
  }
  return names;
}

function extractStepsBlock(source: string, workflowVarName: string): string {
  const startIdx = source.indexOf(`export const ${workflowVarName}`);
  if (startIdx === -1) return '';
  // Find `steps: [` then match the balanced brackets
  const stepsIdx = source.indexOf('steps:', startIdx);
  if (stepsIdx === -1) return '';
  const bracketStart = source.indexOf('[', stepsIdx);
  if (bracketStart === -1) return '';
  let depth = 0;
  let endIdx = bracketStart;
  for (let i = bracketStart; i < source.length; i++) {
    if (source[i] === '[') depth++;
    if (source[i] === ']') depth--;
    if (depth === 0) { endIdx = i + 1; break; }
  }
  return source.slice(bracketStart, endIdx);
}

function extractStepNames(source: string, workflowVarName: string): string[] {
  const block = extractStepsBlock(source, workflowVarName);
  const names: string[] = [];
  const re = /name:\s*'([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    names.push(m[1]);
  }
  return names;
}

function extractStepTypes(source: string, workflowVarName: string): string[] {
  const block = extractStepsBlock(source, workflowVarName);
  const types: string[] = [];
  const re = /type:\s*'([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    types.push(m[1]);
  }
  return types;
}

function extractStepAgents(source: string, workflowVarName: string): string[] {
  const block = extractStepsBlock(source, workflowVarName);
  const agents: string[] = [];
  const re = /agent:\s*'([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    agents.push(m[1]);
  }
  return agents;
}

function extractTypeUnion(source: string, typeName: string): string[] {
  // Matches: export type Foo = 'a' | 'b' | 'c';  (possibly multiline)
  const re = new RegExp(`export type ${typeName}\\s*=[\\s]*([\\s\\S]*?);`);
  const match = source.match(re);
  if (!match) return [];
  const values: string[] = [];
  const valRe = /'([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = valRe.exec(match[1])) !== null) {
    values.push(m[1]);
  }
  return values;
}

// =====================================================
// Collect locale JSON keys recursively
// =====================================================

function collectKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    keys.push(full);
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...collectKeys(v as Record<string, unknown>, full));
    }
  }
  return keys.sort();
}

// =====================================================
// MAIN - async entry point
// =====================================================

async function main() {

// =====================================================
// SUITE 1: Workflow Definition Tests
// =====================================================

await suite('Workflow Definition Tests', () => {
  const workflowKeys = extractWorkflowKeys(workflowSource);
  const expectedKeys = [
    'blog_post',
    'seo_audit',
    'landing_page',
    'social_media_campaign',
    'product_description',
    'email_campaign',
  ];

  test('defaultWorkflows exports exactly 6 workflow keys', () => {
    assertEqual(workflowKeys.length, 6, 'workflow count');
  });

  for (const key of expectedKeys) {
    test(`workflow key "${key}" exists in defaultWorkflows`, () => {
      assert(workflowKeys.includes(key), `missing key: ${key}`);
    });
  }

  const exportedVars = extractExportedWorkflowNames(workflowSource);

  test('each exported workflow variable has a name field', () => {
    for (const varName of exportedVars) {
      const nameMatch = new RegExp(
        `export const ${varName}[\\s\\S]*?name:\\s*'([^']+)'`
      ).exec(workflowSource);
      assert(nameMatch !== null, `${varName} missing name field`);
    }
  });

  test('each exported workflow variable has a description field', () => {
    for (const varName of exportedVars) {
      const descMatch = new RegExp(
        `export const ${varName}[\\s\\S]*?description:\\s*'([^']+)'`
      ).exec(workflowSource);
      assert(descMatch !== null, `${varName} missing description field`);
    }
  });

  test('each exported workflow has at least 1 step', () => {
    for (const varName of exportedVars) {
      const steps = extractStepNames(workflowSource, varName);
      assert(steps.length >= 1, `${varName} has 0 steps`);
    }
  });
});

// =====================================================
// SUITE 2: Agent Registry Tests
// =====================================================

await suite('Agent Registry Tests', () => {
  const agentIndexSource = readFileSync(
    join(ROOT, 'src/lib/agents/index.ts'),
    'utf-8'
  );

  const expectedAgents = [
    'ResearchAgent',
    'WriterAgent',
    'EditorAgent',
    'SeoAgent',
    'PlannerAgent',
  ];

  test('agents/index.ts imports all 5 agent modules', () => {
    const importLines = agentIndexSource
      .split('\n')
      .filter((l) => l.match(/^import\s+['"]\.\//));
    assert(importLines.length >= 5, `only ${importLines.length} side-effect imports found`);
  });

  for (const agentName of expectedAgents) {
    test(`${agentName} is exported from agents/index.ts`, () => {
      assert(
        agentIndexSource.includes(`export { ${agentName} }`),
        `${agentName} not found in exports`
      );
    });
  }

  test('getAgent, hasAgent, getAvailableAgents are exported', () => {
    for (const fn of ['getAgent', 'hasAgent', 'getAvailableAgents']) {
      assert(agentIndexSource.includes(fn), `${fn} not exported`);
    }
  });

  test('registerAgent is exported from base-agent and re-exported', () => {
    assert(agentIndexSource.includes('registerAgent'), 'registerAgent not re-exported');
  });
});

// =====================================================
// SUITE 3: Workflow Step Validation
// =====================================================

await suite('Workflow Step Validation', () => {
  const exportedVars = extractExportedWorkflowNames(workflowSource);
  const validStepTypes = ['ai', 'wait_for_approval', 'publish', 'custom'];

  test('every step across all workflows has a name', () => {
    for (const varName of exportedVars) {
      const names = extractStepNames(workflowSource, varName);
      assert(names.length > 0, `${varName} has steps without names`);
    }
  });

  test('every step across all workflows has a valid type', () => {
    for (const varName of exportedVars) {
      const types = extractStepTypes(workflowSource, varName);
      for (const t of types) {
        assert(validStepTypes.includes(t), `invalid step type "${t}" in ${varName}`);
      }
    }
  });

  test('AI-type steps reference a known agent', () => {
    const knownAgents = [
      'ResearchAgent',
      'WriterAgent',
      'EditorAgent',
      'SeoAgent',
      'PlannerAgent',
    ];
    for (const varName of exportedVars) {
      const agents = extractStepAgents(workflowSource, varName);
      for (const a of agents) {
        assert(knownAgents.includes(a), `unknown agent "${a}" in ${varName}`);
      }
    }
  });

  test('blogPostWorkflow has exactly 7 steps', () => {
    const steps = extractStepNames(workflowSource, 'blogPostWorkflow');
    assertEqual(steps.length, 7, 'blogPostWorkflow step count');
  });

  test('blogPostWorkflow ends with client_approval then publish', () => {
    const steps = extractStepNames(workflowSource, 'blogPostWorkflow');
    assertEqual(steps[steps.length - 2], 'client_approval');
    assertEqual(steps[steps.length - 1], 'publish');
  });
});

// =====================================================
// SUITE 4: Utility Functions Tests
// =====================================================

await suite('Utility Functions Tests', async () => {
  // We import the helpers module dynamically. tsx can handle
  // the TS file if we point at it with an absolute path,
  // but clsx/tailwind-merge need to resolve from the project
  // node_modules. We set up a dynamic import.
  const helpers = await import(helpersPath);

  test('formatDate returns empty string for null', () => {
    assertEqual(helpers.formatDate(null), '');
  });

  test('formatDate returns empty string for undefined', () => {
    assertEqual(helpers.formatDate(undefined), '');
  });

  test('formatDate returns empty string for invalid date', () => {
    assertEqual(helpers.formatDate('not-a-date'), '');
  });

  test('formatDate formats a valid ISO date string', () => {
    const result = helpers.formatDate('2025-03-15T00:00:00Z');
    assert(result.includes('2025'), 'should contain year 2025');
    assert(result.includes('15'), 'should contain day 15');
  });

  test('formatFileSize returns "0 B" for null/undefined/0', () => {
    assertEqual(helpers.formatFileSize(null), '0 B');
    assertEqual(helpers.formatFileSize(undefined), '0 B');
    assertEqual(helpers.formatFileSize(0), '0 B');
  });

  test('formatFileSize converts bytes to KB', () => {
    const result = helpers.formatFileSize(2048);
    assert(result.includes('KB'), `expected KB, got "${result}"`);
  });

  test('formatFileSize converts bytes to MB', () => {
    const result = helpers.formatFileSize(5 * 1024 * 1024);
    assert(result.includes('MB'), `expected MB, got "${result}"`);
  });

  test('formatDuration handles milliseconds', () => {
    assertEqual(helpers.formatDuration(500), '500ms');
  });

  test('formatDuration handles seconds', () => {
    assertEqual(helpers.formatDuration(5000), '5s');
  });

  test('formatDuration handles minutes', () => {
    const result = helpers.formatDuration(90000);
    assert(result.includes('1m'), `expected 1m, got "${result}"`);
  });

  test('truncate shortens long text', () => {
    const result = helpers.truncate('Hello World', 5);
    assertEqual(result, 'Hello...');
  });

  test('truncate leaves short text unchanged', () => {
    assertEqual(helpers.truncate('Hi', 10), 'Hi');
  });

  test('getInitials extracts initials from name', () => {
    assertEqual(helpers.getInitials('John Doe'), 'JD');
    assertEqual(helpers.getInitials('Alice Bob Charlie'), 'AB');
  });

  test('isValidEmail accepts valid emails', () => {
    assert(helpers.isValidEmail('user@example.com'), 'should accept user@example.com');
    assert(helpers.isValidEmail('test+tag@domain.co'), 'should accept test+tag@domain.co');
  });

  test('isValidEmail rejects invalid emails', () => {
    assert(!helpers.isValidEmail('notanemail'), 'should reject plain string');
    assert(!helpers.isValidEmail('@missing.user'), 'should reject missing local part');
    assert(!helpers.isValidEmail('no@'), 'should reject missing domain');
  });

  test('isEmpty handles various empty values', () => {
    assert(helpers.isEmpty(null), 'null should be empty');
    assert(helpers.isEmpty(undefined), 'undefined should be empty');
    assert(helpers.isEmpty(''), 'empty string should be empty');
    assert(helpers.isEmpty('  '), 'whitespace string should be empty');
    assert(helpers.isEmpty([]), 'empty array should be empty');
    assert(helpers.isEmpty({}), 'empty object should be empty');
    assert(!helpers.isEmpty('hello'), 'non-empty string should not be empty');
    assert(!helpers.isEmpty([1]), 'non-empty array should not be empty');
  });

  test('generateId returns a non-empty string', () => {
    const id = helpers.generateId();
    assert(typeof id === 'string' && id.length > 0, 'id should be non-empty string');
  });

  test('generateId with prefix prepends it', () => {
    const id = helpers.generateId('task');
    assert(id.startsWith('task_'), `expected prefix "task_", got "${id}"`);
  });

  test('calculateProgress computes correct percentage', () => {
    assertEqual(helpers.calculateProgress(1, 4), 25);
    assertEqual(helpers.calculateProgress(3, 4), 75);
    assertEqual(helpers.calculateProgress(0, 0), 0);
  });

  test('deepClone produces an independent copy', () => {
    const original = { a: 1, b: { c: 2 } };
    const clone = helpers.deepClone(original);
    clone.b.c = 99;
    assertEqual(original.b.c, 2, 'original should be unmodified');
  });

  test('getDomain extracts domain from URL', () => {
    assertEqual(helpers.getDomain('https://www.example.com/path'), 'example.com');
    assertEqual(helpers.getDomain('http://sub.domain.io'), 'sub.domain.io');
  });

  test('safeJsonParse returns parsed value for valid JSON', () => {
    const result = helpers.safeJsonParse('{"a":1}', {});
    assertEqual(JSON.stringify(result), '{"a":1}');
  });

  test('safeJsonParse returns default for invalid JSON', () => {
    const result = helpers.safeJsonParse('not json', { fallback: true });
    assert((result as any).fallback === true, 'should return default');
  });

  test('cn merges tailwind classes', () => {
    const result = helpers.cn('px-2', 'px-4');
    // tailwind-merge should keep only px-4
    assertEqual(result, 'px-4');
  });

  test('getStatusColor returns a class string for known statuses', () => {
    const statuses = ['pending', 'running', 'completed', 'failed'];
    for (const s of statuses) {
      const cls = helpers.getStatusColor(s, 'bg');
      assert(cls.startsWith('bg-'), `expected bg- class for "${s}", got "${cls}"`);
    }
  });

  test('getStatusColor returns fallback for unknown status', () => {
    const cls = helpers.getStatusColor('unknown_status_xyz');
    assert(typeof cls === 'string' && cls.length > 0, 'should return a fallback class');
  });

  test('sortBy sorts array ascending', () => {
    const arr = [{ v: 3 }, { v: 1 }, { v: 2 }];
    const sorted = helpers.sortBy(arr, 'v', 'asc');
    assertEqual(sorted[0].v, 1);
    assertEqual(sorted[2].v, 3);
  });

  test('groupBy groups array by key', () => {
    const arr = [
      { type: 'a', val: 1 },
      { type: 'b', val: 2 },
      { type: 'a', val: 3 },
    ];
    const grouped = helpers.groupBy(arr, 'type');
    assertEqual(grouped['a'].length, 2);
    assertEqual(grouped['b'].length, 1);
  });
});

// =====================================================
// SUITE 5: Type Validation Tests
// =====================================================

await suite('Type Validation Tests', () => {
  test('TaskType has exactly 10 values', () => {
    const values = extractTypeUnion(typesSource, 'TaskType');
    assertEqual(values.length, 10, `TaskType count: ${values.join(', ')}`);
  });

  test('TaskType includes blog_post, research, seo, dev, design, video, social_media, email_campaign, landing_page, other', () => {
    const values = extractTypeUnion(typesSource, 'TaskType');
    const expected = [
      'blog_post', 'research', 'seo', 'dev', 'design',
      'video', 'social_media', 'email_campaign', 'landing_page', 'other',
    ];
    for (const e of expected) {
      assert(values.includes(e), `TaskType missing "${e}"`);
    }
  });

  test('ProjectStatus has 5 values', () => {
    const values = extractTypeUnion(typesSource, 'ProjectStatus');
    assertEqual(values.length, 5, `ProjectStatus count: ${values.join(', ')}`);
  });

  test('ProjectStatus includes planning, active, on_hold, completed, archived', () => {
    const values = extractTypeUnion(typesSource, 'ProjectStatus');
    for (const e of ['planning', 'active', 'on_hold', 'completed', 'archived']) {
      assert(values.includes(e), `ProjectStatus missing "${e}"`);
    }
  });

  test('JobStatus has 5 values', () => {
    const values = extractTypeUnion(typesSource, 'JobStatus');
    assertEqual(values.length, 5, `JobStatus count: ${values.join(', ')}`);
  });

  test('JobStatus includes queued, running, completed, failed, cancelled', () => {
    const values = extractTypeUnion(typesSource, 'JobStatus');
    for (const e of ['queued', 'running', 'completed', 'failed', 'cancelled']) {
      assert(values.includes(e), `JobStatus missing "${e}"`);
    }
  });

  test('TaskStatus has 8 values', () => {
    const values = extractTypeUnion(typesSource, 'TaskStatus');
    assertEqual(values.length, 8, `TaskStatus count: ${values.join(', ')}`);
  });

  test('LLMProvider has 5 values', () => {
    const values = extractTypeUnion(typesSource, 'LLMProvider');
    assertEqual(values.length, 5, `LLMProvider count: ${values.join(', ')}`);
  });

  test('LLMProvider includes openai, anthropic, google, xai, ollama', () => {
    const values = extractTypeUnion(typesSource, 'LLMProvider');
    for (const e of ['openai', 'anthropic', 'google', 'xai', 'ollama']) {
      assert(values.includes(e), `LLMProvider missing "${e}"`);
    }
  });

  test('ApprovalStatus has 4 values', () => {
    const values = extractTypeUnion(typesSource, 'ApprovalStatus');
    assertEqual(values.length, 4, `ApprovalStatus count: ${values.join(', ')}`);
  });

  test('WorkflowStepStatus has 5 values', () => {
    const values = extractTypeUnion(typesSource, 'WorkflowStepStatus');
    assertEqual(values.length, 5, `WorkflowStepStatus count: ${values.join(', ')}`);
  });
});

// =====================================================
// SUITE 6: Message Files Completeness
// =====================================================

await suite('Message Files Completeness', () => {
  const enJson = JSON.parse(readFileSync(join(messagesDir, 'en.json'), 'utf-8'));
  const enKeys = collectKeys(enJson);

  test('en.json exists and has top-level sections', () => {
    const topLevel = Object.keys(enJson);
    assert(topLevel.length >= 5, `expected at least 5 sections, got ${topLevel.length}`);
  });

  test('en.json contains nav, dashboard, projects, tasks, settings, auth, common sections', () => {
    const expected = ['nav', 'dashboard', 'projects', 'tasks', 'settings', 'auth', 'common'];
    for (const section of expected) {
      assert(enJson[section] !== undefined, `missing section "${section}"`);
    }
  });

  // Check all other locale files have matching keys
  const localeFiles = readdirSync(messagesDir).filter(
    (f) => f.endsWith('.json') && f !== 'en.json'
  );

  if (localeFiles.length === 0) {
    test('no additional locale files to compare (only en.json present)', () => {
      // This is expected in the current codebase; pass
    });
  }

  for (const file of localeFiles) {
    const locale = file.replace('.json', '');
    test(`${file} has the same keys as en.json`, () => {
      const localeJson = JSON.parse(readFileSync(join(messagesDir, file), 'utf-8'));
      const localeKeys = collectKeys(localeJson);
      const missingInLocale = enKeys.filter((k) => !localeKeys.includes(k));
      const extraInLocale = localeKeys.filter((k) => !enKeys.includes(k));
      assert(
        missingInLocale.length === 0,
        `${locale} missing keys: ${missingInLocale.join(', ')}`
      );
      assert(
        extraInLocale.length === 0,
        `${locale} has extra keys: ${extraInLocale.join(', ')}`
      );
    });
  }
});

// =====================================================
// SUMMARY
// =====================================================

console.log(`\n${BOLD}========================================${RESET}`);
console.log(`${BOLD}  Test Results${RESET}`);
console.log(`${BOLD}========================================${RESET}`);
console.log(`  ${GREEN}${passed} passed${RESET}`);
if (failed > 0) {
  console.log(`  ${RED}${failed} failed${RESET}`);
  console.log(`\n${RED}${BOLD}Failures:${RESET}`);
  for (const f of failures) {
    console.log(`  ${RED}- ${f}${RESET}`);
  }
}
console.log('');

process.exit(failed > 0 ? 1 : 0);

} // end main

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(2);
});
