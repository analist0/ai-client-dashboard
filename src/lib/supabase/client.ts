/**
 * Supabase Client Configuration
 * Supports both server-side and client-side usage
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

type DBClient = ReturnType<typeof createClient<Database>>;

// =====================================================
// ENVIRONMENT VARIABLES
// =====================================================

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getEnvVars() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing Supabase environment variables. Please check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }
  return { supabaseUrl: url, supabaseAnonKey: key };
}

// =====================================================
// TYPES
// =====================================================

export type TypedSupabaseClient = DBClient;

// =====================================================
// CLIENT-SIDE CLIENT
// =====================================================

let clientClient: DBClient | null = null;

/**
 * Get or create the client-side Supabase client
 * Uses the anon key for browser-based operations
 */
export function createBrowserClient(): DBClient {
  if (clientClient) {
    return clientClient;
  }

  const { supabaseUrl, supabaseAnonKey } = getEnvVars();
  clientClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });

  return clientClient;
}

// =====================================================
// SERVER-SIDE CLIENT
// =====================================================

/**
 * Create a server-side Supabase client
 * @param accessToken - Optional user access token for authenticated requests
 * @param useServiceRole - Use service role key for admin operations (bypasses RLS)
 */
export function createServerClient(
  accessToken?: string,
  useServiceRole = false
): DBClient {
  const { supabaseUrl, supabaseAnonKey } = getEnvVars();
  const supabaseKey = useServiceRole && supabaseServiceKey ? supabaseServiceKey : supabaseAnonKey;

  return createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      ...(accessToken && {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }),
    },
  });
}

/**
 * Create an admin client that bypasses RLS
 * WARNING: Use with caution - this client has full database access
 */
export function createAdminClient(): DBClient {
  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin operations');
  }

  return createServerClient(undefined, true);
}

// =====================================================
// MIDDLEWARE CLIENT
// =====================================================

/**
 * Create a client for use in Next.js middleware
 * Minimal configuration for auth cookie handling
 */
export function createMiddlewareClient(
  req: Request,
  res: Response
): DBClient {
  const { supabaseUrl, supabaseAnonKey } = getEnvVars();
  // Note: For full middleware support, use @supabase/ssr
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get the current user from an authenticated client
 */
export async function getCurrentUser(client: DBClient) {
  try {
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) {
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

/**
 * Get the current session
 */
export async function getCurrentSession(client: DBClient) {
  try {
    const { data: { session }, error } = await client.auth.getSession();
    if (error || !session) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

/**
 * Sign out the current user
 */
export async function signOut(client: DBClient) {
  const { error } = await client.auth.signOut();
  return { success: !error, error };
}

// =====================================================
// EXPORTS
// =====================================================

export { createClient } from '@supabase/supabase-js';
export type { Database };
