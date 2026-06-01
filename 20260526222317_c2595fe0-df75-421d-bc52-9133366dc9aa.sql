CREATE TABLE public.appuntamenti (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome_cliente TEXT NOT NULL,
  servizio TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  durata_minuti INTEGER NOT NULL DEFAULT 30,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appuntamenti TO authenticated;
GRANT ALL ON public.appuntamenti TO service_role;

ALTER TABLE public.appuntamenti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own appuntamenti" ON public.appuntamenti FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own appuntamenti" ON public.appuntamenti FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own appuntamenti" ON public.appuntamenti FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own appuntamenti" ON public.appuntamenti FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_appuntamenti_user_start ON public.appuntamenti(user_id, start_at);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_appuntamenti_updated_at
BEFORE UPDATE ON public.appuntamenti
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();