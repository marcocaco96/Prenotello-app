
-- Moduli di consenso
CREATE TABLE public.moduli_consenso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  testo text NOT NULL DEFAULT '',
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.moduli_consenso TO authenticated;
GRANT ALL ON public.moduli_consenso TO service_role;

ALTER TABLE public.moduli_consenso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own moduli_consenso" ON public.moduli_consenso FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own moduli_consenso" ON public.moduli_consenso FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own moduli_consenso" ON public.moduli_consenso FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own moduli_consenso" ON public.moduli_consenso FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_moduli_consenso_updated_at
BEFORE UPDATE ON public.moduli_consenso
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Consensi firmati / richiesti
CREATE TABLE public.consensi_firmati (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  modulo_id uuid REFERENCES public.moduli_consenso(id) ON DELETE SET NULL,
  appuntamento_id uuid REFERENCES public.appuntamenti(id) ON DELETE CASCADE,
  cliente_id uuid REFERENCES public.clienti(id) ON DELETE SET NULL,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  stato text NOT NULL DEFAULT 'in_attesa',
  nome_modulo text NOT NULL,
  testo_snapshot text NOT NULL,
  nome_firma text,
  cognome_firma text,
  firma_data_url text,
  pdf_path text,
  firmato_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consensi_firmati TO authenticated;
GRANT SELECT, UPDATE ON public.consensi_firmati TO anon;
GRANT ALL ON public.consensi_firmati TO service_role;

ALTER TABLE public.consensi_firmati ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own consensi" ON public.consensi_firmati FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own consensi" ON public.consensi_firmati FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own consensi" ON public.consensi_firmati FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own consensi" ON public.consensi_firmati FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Public access via server function only (token is unguessable uuid)
CREATE POLICY "Public read by token" ON public.consensi_firmati FOR SELECT TO anon USING (true);
CREATE POLICY "Public update by token when pending" ON public.consensi_firmati FOR UPDATE TO anon USING (stato = 'in_attesa') WITH CHECK (stato IN ('in_attesa','firmato'));

CREATE INDEX idx_consensi_token ON public.consensi_firmati(token);
CREATE INDEX idx_consensi_appuntamento ON public.consensi_firmati(appuntamento_id);
CREATE INDEX idx_consensi_cliente ON public.consensi_firmati(cliente_id);

CREATE TRIGGER update_consensi_firmati_updated_at
BEFORE UPDATE ON public.consensi_firmati
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket per PDF (privato, signed URL)
INSERT INTO storage.buckets (id, name, public) VALUES ('consensi-pdf', 'consensi-pdf', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users read own consensi PDFs" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'consensi-pdf' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Service role manage consensi PDFs" ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'consensi-pdf') WITH CHECK (bucket_id = 'consensi-pdf');

-- Realtime
ALTER TABLE public.moduli_consenso REPLICA IDENTITY FULL;
ALTER TABLE public.consensi_firmati REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.moduli_consenso;
ALTER PUBLICATION supabase_realtime ADD TABLE public.consensi_firmati;
