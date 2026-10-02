-- =============================================================================
-- AUTOCAR BS ERP - OFICINA & ESTOQUE
-- MIGRAÇÃO DE BANCO DE DADOS: CATÁLOGO DE SERVIÇOS & MÃO DE OBRA
--
-- Execute este script no SQL Editor do Supabase (https://supabase.com/dashboard)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.servicos (
    id BIGSERIAL PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nome VARCHAR(255) NOT NULL,
    preco NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    tempo_estimado VARCHAR(50) DEFAULT '01:00',
    categoria VARCHAR(100) DEFAULT 'Mecânica Geral',
    descricao TEXT,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para buscas rápidas por nome, código e categoria
CREATE INDEX IF NOT EXISTS idx_servicos_codigo ON public.servicos(codigo);
CREATE INDEX IF NOT EXISTS idx_servicos_nome ON public.servicos(nome);
CREATE INDEX IF NOT EXISTS idx_servicos_categoria ON public.servicos(categoria);
CREATE INDEX IF NOT EXISTS idx_servicos_ativo ON public.servicos(ativo);

-- Seed inicial com os serviços reais do sistema atual
INSERT INTO public.servicos (codigo, nome, preco, tempo_estimado, categoria, descricao, ativo)
VALUES
    ('1281', 'SUBS. JUNTA CARTER', 1125.00, '02:30', 'Motor & Injeção', 'Substituição completa da junta do carter do motor com limpeza, desengraxe e aplicação de vedante de alta temperatura.', true),
    ('1280', 'SUBS. RETENTOR DO EIXO COMPRESSOR', 100.00, '01:00', 'Ar Condicionado', 'Substituição do retentor do eixo do compressor de ar condicionado para eliminação de vazamentos.', true),
    ('1279', 'DESMONTAGEM E REPARO NO ALTERNADOR', 740.00, '02:00', 'Elétrica & Eletrônica', 'Desmontagem, teste de bancada, troca de regulador/rolamentos e revisão geral do alternador.', true),
    ('1278', 'SUBS. VALVULA DE SERVIÇO AR COND.', 250.00, '00:45', 'Ar Condicionado', 'Troca da válvula de serviço de alta/baixa pressão e teste de estanqueidade no sistema de ar condicionado.', true),
    ('1277', 'SUBS. DA BOBINA MAGNETICA AR COND.', 250.00, '01:00', 'Ar Condicionado', 'Substituição da bobina magnética da embreagem do compressor de ar condicionado.', true),
    ('1276', 'SUBS. ROLAMENTO GUIA', 250.00, '00:45', 'Motor & Injeção', 'Substituição do rolamento guia da correia de acessórios / dentada.', true),
    ('1275', 'REMAP STAGE1 / REMOÇÃO DELAY', 2500.00, '01:30', 'Performance & Remap', 'Reprogramação eletrônica de injeção Stage 1 para ganho de potência, torque e eliminação do delay no pedal de aceleração.', true),
    ('1274', 'SUBS. TRAVA WASTGATE', 65.00, '00:30', 'Motor & Injeção', 'Substituição da presilha/trava da haste da válvula wastegate da turbina.', true)
ON CONFLICT (codigo) DO NOTHING;

COMMENT ON TABLE public.servicos IS 'Catálogo de serviços e valores de mão de obra da oficina AutoCar BS';
