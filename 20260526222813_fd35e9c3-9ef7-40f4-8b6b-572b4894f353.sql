CREATE TABLE public.clienti (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  cognome TEXT NOT NULL,
  telefono TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clienti TO authenticated;
GRANT ALL ON public.clienti TO service_role;

ALTER TABLE public.clienti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own clienti" ON public.clienti FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own clienti" ON public.clienti FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own clienti" ON public.clienti FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own clienti" ON public.clienti FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_clienti_user ON public.clienti(user_id);

CREATE TRIGGER update_clienti_updated_at
BEFORE UPDATE ON public.clienti
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.appuntamenti
  ADD COLUMN cliente_id UUID REFERENCES public.clienti(id) ON DELETE SET NULL;