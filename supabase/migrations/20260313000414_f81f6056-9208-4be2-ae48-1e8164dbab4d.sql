
-- Table for member schedules (escalas)
CREATE TABLE public.escalas_membros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  membro_id UUID NOT NULL REFERENCES public.tarefas_membros(id) ON DELETE CASCADE,
  dia_semana INTEGER NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
  hora_inicio TEXT NOT NULL,
  hora_fim TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table for member absences
CREATE TABLE public.ausencias_membros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  membro_id UUID NOT NULL REFERENCES public.tarefas_membros(id) ON DELETE CASCADE,
  data_inicio TEXT NOT NULL,
  data_fim TEXT NOT NULL,
  hora_inicio TEXT,
  hora_fim TEXT,
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.escalas_membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ausencias_membros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own member schedules" ON public.escalas_membros
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can manage own member absences" ON public.ausencias_membros
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
