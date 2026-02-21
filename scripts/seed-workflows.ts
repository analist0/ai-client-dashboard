#!/usr/bin/env node
/**
 * Seed default workflows to the database
 */

import { createClient } from '@supabase/supabase-js';
import { defaultWorkflows } from '../src/lib/workflows/default-workflows.js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedWorkflows() {
  console.log('Seeding workflows...');

  const workflowMappings: Record<string, string> = {
    blog_post: 'blog_post',
    seo_audit: 'seo',
    landing_page: 'landing_page',
    social_media_campaign: 'social_media',
    product_description: 'other',
    email_campaign: 'email_campaign',
  };

  for (const [name, workflow] of Object.entries(defaultWorkflows)) {
    const taskType = workflowMappings[name] || 'other';

    // Check if workflow already exists
    const { data: existing } = await supabase
      .from('workflows')
      .select('id')
      .eq('name', workflow.name)
      .single();

    if (existing) {
      console.log(`  Skipping existing workflow: ${workflow.name}`);
      continue;
    }

    // Insert workflow
    const { data, error } = await supabase
      .from('workflows')
      .insert({
        name: workflow.name,
        description: workflow.description,
        task_type: taskType,
        definition: workflow,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error(`  Error inserting workflow ${workflow.name}:`, error.message);
    } else {
      console.log(`  Created workflow: ${workflow.name} (${data.id})`);
    }
  }

  console.log('Workflow seeding complete!');
}

seedWorkflows().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
