CREATE TABLE reembolsos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  descricao TEXT NOT NULL,
  valor BIGINT NOT NULL, -- em centavos
  data_competencia DATE NOT NULL,
  credito_para_id UUID REFERENCES membros(id) NOT NULL
);

-- Ativar RLS
ALTER TABLE reembolsos ENABLE ROW LEVEL SECURITY;

-- Criar política pública para MVP (ajuste conforme a necessidade)
CREATE POLICY "Permitir leitura pública" ON reembolsos FOR SELECT USING (true);
CREATE POLICY "Permitir inserção pública" ON reembolsos FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir deleção pública" ON reembolsos FOR DELETE USING (true);
