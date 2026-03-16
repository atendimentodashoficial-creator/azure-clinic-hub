
-- Tabela de cobranças
CREATE TABLE public.cobrancas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  cliente_id UUID NOT NULL REFERENCES public.tarefas_clientes(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  tipo TEXT NOT NULL DEFAULT 'unico', -- 'mrr' ou 'unico'
  status TEXT NOT NULL DEFAULT 'pendente', -- 'pendente', 'pago', 'atrasado', 'cancelado'
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  metodo_pagamento TEXT, -- 'pix', 'boleto', 'cartao', 'transferencia', 'dinheiro'
  observacoes TEXT,
  recorrencia_ativa BOOLEAN DEFAULT false,
  recorrencia_origem_id UUID REFERENCES public.cobrancas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.cobrancas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own cobrancas"
  ON public.cobrancas
  FOR ALL
  TO authenticated
  USING (user_id = (SELECT public.get_owner_id(auth.uid())))
  WITH CHECK (user_id = (SELECT public.get_owner_id(auth.uid())));

-- Trigger updated_at
CREATE TRIGGER update_cobrancas_updated_at
  BEFORE UPDATE ON public.cobrancas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
