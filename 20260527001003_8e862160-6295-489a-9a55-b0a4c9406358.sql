
ALTER TABLE public.saloni
  ADD COLUMN IF NOT EXISTS pagamento_online_obbligatorio boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_attivo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_secret_key text,
  ADD COLUMN IF NOT EXISTS stripe_publishable_key text,
  ADD COLUMN IF NOT EXISTS stripe_webhook_secret text,
  ADD COLUMN IF NOT EXISTS satispay_attivo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS satispay_key_id text,
  ADD COLUMN IF NOT EXISTS satispay_private_key text;

ALTER TABLE public.appuntamenti
  ADD COLUMN IF NOT EXISTS stato_pagamento text NOT NULL DEFAULT 'da_pagare',
  ADD COLUMN IF NOT EXISTS metodo_pagamento text,
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS importo numeric(10,2);

CREATE INDEX IF NOT EXISTS idx_appuntamenti_stripe_session ON public.appuntamenti(stripe_session_id);
