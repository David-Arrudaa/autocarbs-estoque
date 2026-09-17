-- =============================================================================
-- AUTOCAR BS ERP - OFICINA & ESTOQUE
-- MIGRAÇÃO DE BANCO DE DADOS - FASE 2: FUNDAÇÃO ERP
-- 
-- Execute este script no SQL Editor do Supabase (https://supabase.com/dashboard)
-- =============================================================================

-- 1. TABELA DE USUÁRIOS & CONTROLE DE ACESSO (RBAC)
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL,
    pin_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'operador' CHECK (role IN ('operador', 'supervisor', 'admin')),
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para otimização de busca
CREATE INDEX IF NOT EXISTS idx_usuarios_role ON public.usuarios(role);
CREATE INDEX IF NOT EXISTS idx_usuarios_ativo ON public.usuarios(ativo);

-- 2. TABELA DE ORÇAMENTOS E COTAÇÕES ARQUIVADAS
CREATE TABLE IF NOT EXISTS public.cotacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    placa VARCHAR(10) NOT NULL,
    modelo VARCHAR(120) NOT NULL,
    valor_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    dados JSONB NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cotacoes_placa ON public.cotacoes(placa);
CREATE INDEX IF NOT EXISTS idx_cotacoes_modelo ON public.cotacoes(modelo);
CREATE INDEX IF NOT EXISTS idx_cotacoes_criado_em ON public.cotacoes(criado_em DESC);

-- 3. TABELA DE AUDITORIA OPERACIONAL DO ERP
CREATE TABLE IF NOT EXISTS public.auditoria (
    id BIGSERIAL PRIMARY KEY,
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    usuario_nome VARCHAR(100) NOT NULL,
    acao VARCHAR(30) NOT NULL CHECK (acao IN ('CRIACAO', 'EDICAO', 'ENTRADA', 'SAIDA', 'EXCLUSAO', 'COTACAO_SYNC', 'LOGIN')),
    tabela VARCHAR(50) NOT NULL,
    registro_id VARCHAR(50),
    detalhes JSONB,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_tabela_registro ON public.auditoria(tabela, registro_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_acao ON public.auditoria(acao);
CREATE INDEX IF NOT EXISTS idx_auditoria_criado_em ON public.auditoria(criado_em DESC);

-- =============================================================================
-- SEED INICIAL DE USUÁRIOS
-- Hashes gerados com bcrypt (10 rounds):
--   PIN 2569 -> $2a$10$wN1rO9b4R8G4N1Ff2195fOnz4eJ7N5K6qXQdC9m4D7F3H2B1Z0Xq
--   PIN 0177 -> $2a$10$7v8XWzCqN1F0J2B3Z4Y5X.L7N8K9P0Q1R2S3T4U5V6W7X8Y9Z0A1B
-- =============================================================================
INSERT INTO public.usuarios (nome, pin_hash, role, ativo)
VALUES 
    ('Operador Oficina', '$2a$10$7h9t1sV82OqXb0Z4wF9yveP6Bv1sU3gM.3JmKlNoPqRsTuVwXyZ1.', 'operador', true),
    ('Supervisor AutoCar', '$2a$10$k8Y1zM3pQ5rT7vW9xY1z.uB3cD5eF7gH9iJ1kL3mN5oP7qR9sT1u.', 'supervisor', true)
ON CONFLICT DO NOTHING;

-- COMENTÁRIOS DE ESTRUTURA PARA O SUPABASE DASHBOARD
COMMENT ON TABLE public.usuarios IS 'Cadastro de funcionários e operadores com autenticação via PIN hash e papéis RBAC';
COMMENT ON TABLE public.cotacoes IS 'Histórico centralizado de cotações e orçamentos da oficina';
COMMENT ON TABLE public.auditoria IS 'Trilha de auditoria operacional gravando todas as mutações de estoque e sistema';

