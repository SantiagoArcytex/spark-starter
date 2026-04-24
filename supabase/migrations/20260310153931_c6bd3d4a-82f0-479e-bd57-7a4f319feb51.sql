
-- Step 1: Expand app_role enum only
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'tech_lead';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
