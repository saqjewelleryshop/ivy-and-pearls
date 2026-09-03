import {z} from 'zod';

const productionSchema=z.object({
  NODE_ENV:z.literal('production'),
  SITE_URL:z.string().url().optional(),
  VITE_SITE_URL:z.string().url().optional(),
  FRONTEND_URL:z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY:z.string().min(20).optional(),
  SUPABASE_URL:z.string().url().optional(),
  VITE_SUPABASE_URL:z.string().url().optional(),
  RESEND_API_KEY:z.string().min(8).optional(),
  PARTNER_API_KEY:z.string().min(8).optional()
});

/**
 * Production configuration inspection must NEVER crash a serverless module at
 * import time. Vercel reports any top-level throw as FUNCTION_INVOCATION_FAILED,
 * which makes even health/static SSR requests unavailable.
 *
 * The storefront can render a controlled configuration-pending state when
 * Supabase is unavailable, so missing optional/runtime configuration is
 * reported rather than thrown.
 */
export function validateProductionEnv(env=process.env,{strict=false}={}){
  if(env.NODE_ENV!=='production') return {ok:true,issues:[],data:env};

  const parsed=productionSchema.safeParse(env);
  const issues=[];
  if(!parsed.success){
    for(const issue of parsed.error.issues){
      issues.push(`${issue.path.join('.')||'environment'}: ${issue.message}`);
    }
  }

  const value=parsed.success?parsed.data:env;
  const siteUrl=value.SITE_URL||value.VITE_SITE_URL||value.FRONTEND_URL;
  const supabaseUrl=value.SUPABASE_URL||value.VITE_SUPABASE_URL;

  // These are readiness issues, not reasons to crash module evaluation.
  if(!siteUrl) issues.push('SITE_URL, VITE_SITE_URL or FRONTEND_URL is required for canonical production URLs');
  if(!supabaseUrl) issues.push('SUPABASE_URL or VITE_SUPABASE_URL is required for database-backed commerce');
  if(!value.SUPABASE_SERVICE_ROLE_KEY) issues.push('SUPABASE_SERVICE_ROLE_KEY is required for server-side commerce');

  const result={
    ok:issues.length===0,
    issues:[...new Set(issues)],
    data:parsed.success?parsed.data:undefined,
    resolved:{siteUrl,hasSupabase:Boolean(supabaseUrl&&value.SUPABASE_SERVICE_ROLE_KEY)}
  };

  if(strict&&!result.ok){
    throw new Error(`Invalid production environment: ${result.issues.join('; ')}`);
  }
  return result;
}
