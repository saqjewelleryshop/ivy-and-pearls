import {z} from 'zod';

const productionSchema=z.object({
  NODE_ENV:z.literal('production'),
  SITE_URL:z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY:z.string().min(20),
  SUPABASE_URL:z.string().url().optional(),
  VITE_SUPABASE_URL:z.string().url().optional(),
  FRONTEND_URL:z.string().url().optional(),
  RESEND_API_KEY:z.string().min(8).optional(),
  PARTNER_API_KEY:z.string().min(8).optional()
}).superRefine((env,ctx)=>{
  if(!env.SUPABASE_URL&&!env.VITE_SUPABASE_URL){
    ctx.addIssue({code:'custom',path:['SUPABASE_URL'],message:'SUPABASE_URL or VITE_SUPABASE_URL is required'});
  }
});

export function validateProductionEnv(env=process.env){
  if(env.NODE_ENV!=='production') return {ok:true};
  const parsed=productionSchema.safeParse(env);
  if(!parsed.success){
    const missing=[...new Set(parsed.error.issues.map(i=>i.path.join('.')||'environment'))].join(', ');
    throw new Error(`Invalid production environment: ${missing}`);
  }
  return {ok:true,data:parsed.data};
}
