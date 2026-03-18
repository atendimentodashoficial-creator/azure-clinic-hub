
CREATE TABLE public.cobranca_pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cobranca_id UUID NOT NULL REFERENCES public.cobrancas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  valor NUMERIC NOT NULL DEFAULT 0,
  data_pagamento DATE NOT NULL DEFAULT CURRENT_DATE,
  data_proximo_pagamento DATE,
  comprovante_url TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cobranca_pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cobranca_pagamentos"
  ON public.cobranca_pagamentos FOR SELECT TO authenticated
  USING (public.can_access_owner_data(auth.uid(), user_id));

CREATE POLICY "Users can insert own cobranca_pagamentos"
  ON public.cobranca_pagamentos FOR INSERT TO authenticated
  WITH CHECK (public.can_access_owner_data(auth.uid(), user_id));

CREATE POLICY "Users can delete own cobranca_pagamentos"
  ON public.cobranca_pagamentos FOR DELETE TO authenticated
  USING (public.can_access_owner_data(auth.uid(), user_id));
