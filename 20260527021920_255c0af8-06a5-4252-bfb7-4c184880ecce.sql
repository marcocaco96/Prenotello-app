CREATE TABLE public.prodotti (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  categoria TEXT,
  marca TEXT,
  prezzo_acquisto NUMERIC,
  prezzo_vendita NUMERIC,
  quantita INTEGER NOT NULL DEFAULT 0,
  quantita_minima INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prodotti TO authenticated;
GRANT ALL ON public.prodotti TO service_role;
ALTER TABLE public.prodotti ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own prodotti" ON public.prodotti FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own prodotti" ON public.prodotti FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own prodotti" ON public.prodotti FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own prodotti" ON public.prodotti FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_prodotti_updated_at BEFORE UPDATE ON public.prodotti FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.vendite_prodotti (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  appuntamento_id UUID REFERENCES public.appuntamenti(id) ON DELETE CASCADE,
  prodotto_id UUID REFERENCES public.prodotti(id) ON DELETE SET NULL,
  nome_prodotto TEXT NOT NULL,
  quantita INTEGER NOT NULL DEFAULT 1,
  prezzo_unitario NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendite_prodotti TO authenticated;
GRANT ALL ON public.vendite_prodotti TO service_role;
ALTER TABLE public.vendite_prodotti ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own vendite" ON public.vendite_prodotti FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own vendite" ON public.vendite_prodotti FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own vendite" ON public.vendite_prodotti FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own vendite" ON public.vendite_prodotti FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_vendite_prodotti_appuntamento ON public.vendite_prodotti(appuntamento_id);
CREATE INDEX idx_vendite_prodotti_prodotto ON public.vendite_prodotti(prodotto_id);