
ALTER TABLE public.saloni
  ADD COLUMN IF NOT EXISTS modalita_pagamento_online text NOT NULL DEFAULT 'disattivato';

ALTER TABLE public.saloni
  DROP CONSTRAINT IF EXISTS saloni_modalita_pagamento_online_check;

ALTER TABLE public.saloni
  ADD CONSTRAINT saloni_modalita_pagamento_online_check
  CHECK (modalita_pagamento_online IN ('disattivato', 'opzionale', 'obbligatorio'));

UPDATE public.saloni
  SET modalita_pagamento_online = 'obbligatorio'
  WHERE pagamento_online_obbligatorio = true
    AND modalita_pagamento_online = 'disattivato';

ALTER TABLE public.clienti
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS allergie text;
