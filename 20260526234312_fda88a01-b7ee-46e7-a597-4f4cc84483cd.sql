ALTER TABLE public.appuntamenti ADD COLUMN IF NOT EXISTS stato TEXT NOT NULL DEFAULT 'programmato';
CREATE INDEX IF NOT EXISTS idx_appuntamenti_user_start ON public.appuntamenti(user_id, start_at);
CREATE INDEX IF NOT EXISTS idx_appuntamenti_stato ON public.appuntamenti(stato);