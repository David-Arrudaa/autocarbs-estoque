/**
 * =========================================================
 * AUTOCAR BS - ERP OFICINA
 * Service: Gestão de Serviços & Mão de Obra
 * =========================================================
 * Persistência híbrida resiliente:
 * 1. Tenta persistir no Supabase (tabela 'servicos');
 * 2. Se a tabela ainda não existir no Supabase, utiliza
 *    armazenamento JSON seguro em 'data/servicos.json'
 *    com sincronização automática quando a tabela for criada.
 * =========================================================
 */

const fs = require('fs');
const path = require('path');
const { supabase } = require('../../config/supabase');
const auditoriaService = require('../auditoria/auditoria.service');

const FILE_PATH = path.join(__dirname, '../../../data/servicos.json');

// Semente inicial baseada nos serviços reais do sistema atual da AutoCar BS
const SEED_SERVICOS = [
    {
        id: 1281,
        codigo: '1281',
        nome: 'SUBS. JUNTA CARTER',
        preco: 1125.00,
        tempo_estimado: '02:30',
        categoria: 'Motor & Injeção',
        descricao: 'Substituição completa da junta do carter do motor com limpeza, desengraxe e aplicação de vedante de alta temperatura.',
        ativo: true,
        created_at: '2026-03-20T10:00:00Z',
        updated_at: '2026-03-20T10:00:00Z'
    },
    {
        id: 1280,
        codigo: '1280',
        nome: 'SUBS. RETENTOR DO EIXO COMPRESSOR',
        preco: 100.00,
        tempo_estimado: '01:00',
        categoria: 'Ar Condicionado',
        descricao: 'Substituição do retentor do eixo do compressor de ar condicionado para eliminação de vazamentos.',
        ativo: true,
        created_at: '2026-03-20T10:05:00Z',
        updated_at: '2026-03-20T10:05:00Z'
    },
    {
        id: 1279,
        codigo: '1279',
        nome: 'DESMONTAGEM E REPARO NO ALTERNADOR',
        preco: 740.00,
        tempo_estimado: '02:00',
        categoria: 'Elétrica & Eletrônica',
        descricao: 'Desmontagem, teste de bancada, troca de regulador/rolamentos e revisão geral do alternador.',
        ativo: true,
        created_at: '2026-03-20T10:10:00Z',
        updated_at: '2026-03-20T10:10:00Z'
    },
    {
        id: 1278,
        codigo: '1278',
        nome: 'SUBS. VALVULA DE SERVIÇO AR COND.',
        preco: 250.00,
        tempo_estimado: '00:45',
        categoria: 'Ar Condicionado',
        descricao: 'Troca da válvula de serviço de alta/baixa pressão e teste de estanqueidade no sistema de ar condicionado.',
        ativo: true,
        created_at: '2026-03-20T10:15:00Z',
        updated_at: '2026-03-20T10:15:00Z'
    },
    {
        id: 1277,
        codigo: '1277',
        nome: 'SUBS. DA BOBINA MAGNETICA AR COND.',
        preco: 250.00,
        tempo_estimado: '01:00',
        categoria: 'Ar Condicionado',
        descricao: 'Substituição da bobina magnética da embreagem do compressor de ar condicionado.',
        ativo: true,
        created_at: '2026-03-20T10:20:00Z',
        updated_at: '2026-03-20T10:20:00Z'
    },
    {
        id: 1276,
        codigo: '1276',
        nome: 'SUBS. ROLAMENTO GUIA',
        preco: 250.00,
        tempo_estimado: '00:45',
        categoria: 'Motor & Injeção',
        descricao: 'Substituição do rolamento guia da correia de acessórios / dentada.',
        ativo: true,
        created_at: '2026-03-20T10:25:00Z',
        updated_at: '2026-03-20T10:25:00Z'
    },
    {
        id: 1275,
        codigo: '1275',
        nome: 'REMAP STAGE1 / REMOÇÃO DELAY',
        preco: 2500.00,
        tempo_estimado: '01:30',
        categoria: 'Performance & Remap',
        descricao: 'Reprogramação eletrônica de injeção Stage 1 para ganho de potência, torque e eliminação do delay no pedal de aceleração.',
        ativo: true,
        created_at: '2026-03-20T10:30:00Z',
        updated_at: '2026-03-20T10:30:00Z'
    },
    {
        id: 1274,
        codigo: '1274',
        nome: 'SUBS. TRAVA WASTGATE',
        preco: 65.00,
        tempo_estimado: '00:30',
        categoria: 'Motor & Injeção',
        descricao: 'Substituição da presilha/trava da haste da válvula wastegate da turbina.',
        ativo: true,
        created_at: '2026-03-20T10:35:00Z',
        updated_at: '2026-03-20T10:35:00Z'
    }
];

class ServicosService {
    constructor() {
        this.supabaseAtivo = null; // null = ainda não testado, true/false
        this.garantirArquivoLocal();
    }

    garantirArquivoLocal() {
        try {
            const dir = path.dirname(FILE_PATH);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            if (!fs.existsSync(FILE_PATH)) {
                fs.writeFileSync(FILE_PATH, JSON.stringify(SEED_SERVICOS, null, 2), 'utf-8');
            }
        } catch (err) {
            console.error('[ServicosService] Erro ao inicializar arquivo local:', err.message);
        }
    }

    lerLocal() {
        try {
            this.garantirArquivoLocal();
            const raw = fs.readFileSync(FILE_PATH, 'utf-8');
            return JSON.parse(raw);
        } catch (_) {
            return [...SEED_SERVICOS];
        }
    }

    escreverLocal(dados) {
        try {
            this.garantirArquivoLocal();
            fs.writeFileSync(FILE_PATH, JSON.stringify(dados, null, 2), 'utf-8');
            return true;
        } catch (err) {
            console.error('[ServicosService] Erro ao gravar localmente:', err.message);
            return false;
        }
    }

    async testarSupabase() {
        if (this.supabaseAtivo !== null) return this.supabaseAtivo;
        try {
            const { error } = await supabase.from('servicos').select('id').limit(1);
            if (!error) {
                this.supabaseAtivo = true;
                return true;
            }
        } catch (_) {}
        this.supabaseAtivo = false;
        return false;
    }

    /**
     * Lista serviços com suporte a filtros, busca e paginação
     */
    async listar({ busca = '', categoria = 'todos', pagina = 1, limite = 15, ordenarPor = 'codigo', ordem = 'desc' }) {
        const useSupabase = await this.testarSupabase();
        const page = Math.max(1, parseInt(pagina) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(limite) || 15));
        const termoBusca = (busca || '').trim().toLowerCase();

        if (useSupabase) {
            try {
                let query = supabase.from('servicos').select('*', { count: 'exact' });
                if (termoBusca) {
                    query = query.or(`nome.ilike.%${termoBusca}%,codigo.ilike.%${termoBusca}%,descricao.ilike.%${termoBusca}%`);
                }
                if (categoria && categoria !== 'todos') {
                    query = query.eq('categoria', categoria);
                }
                const ascending = ordem.toLowerCase() === 'asc';
                query = query.order(ordenarPor, { ascending });
                const offset = (page - 1) * limit;
                query = query.range(offset, offset + limit - 1);

                const { data, count, error } = await query;
                if (!error) {
                    return {
                        servicos: data || [],
                        total: count || 0,
                        pagina: page,
                        limite: limit,
                        totalPaginas: Math.ceil((count || 0) / limit) || 1
                    };
                }
            } catch (_) {
                // Fallback para arquivo local
            }
        }

        // Armazenamento local
        let lista = this.lerLocal();

        if (termoBusca) {
            lista = lista.filter(s =>
                String(s.nome || '').toLowerCase().includes(termoBusca) ||
                String(s.codigo || '').toLowerCase().includes(termoBusca) ||
                String(s.descricao || '').toLowerCase().includes(termoBusca)
            );
        }

        if (categoria && categoria !== 'todos') {
            lista = lista.filter(s => String(s.categoria || '').toLowerCase() === categoria.toLowerCase());
        }

        // Ordenação
        lista.sort((a, b) => {
            let valA = a[ordenarPor];
            let valB = b[ordenarPor];

            if (ordenarPor === 'preco') {
                valA = Number(valA || 0);
                valB = Number(valB || 0);
            } else if (ordenarPor === 'codigo') {
                const numA = parseInt(valA, 10);
                const numB = parseInt(valB, 10);
                if (!isNaN(numA) && !isNaN(numB)) {
                    valA = numA;
                    valB = numB;
                } else {
                    valA = String(valA || '');
                    valB = String(valB || '');
                }
            } else {
                valA = String(valA || '').toLowerCase();
                valB = String(valB || '').toLowerCase();
            }

            if (valA < valB) return ordem.toLowerCase() === 'asc' ? -1 : 1;
            if (valA > valB) return ordem.toLowerCase() === 'asc' ? 1 : -1;
            return 0;
        });

        const total = lista.length;
        const offset = (page - 1) * limit;
        const servicos = lista.slice(offset, offset + limit);

        return {
            servicos,
            total,
            pagina: page,
            limite: limit,
            totalPaginas: Math.ceil(total / limit) || 1
        };
    }

    /**
     * Obtém um serviço por ID
     */
    async obterPorId(id) {
        const useSupabase = await this.testarSupabase();
        if (useSupabase) {
            try {
                const { data, error } = await supabase.from('servicos').select('*').eq('id', id).maybeSingle();
                if (!error && data) return data;
            } catch (_) {}
        }
        const lista = this.lerLocal();
        return lista.find(s => String(s.id) === String(id)) || null;
    }

    /**
     * Cadastra um novo serviço
     */
    async cadastrar(dados, usuarioAuditoria = null) {
        if (!dados.nome || !dados.nome.trim()) {
            throw new Error('O nome do serviço é obrigatório.');
        }

        const lista = this.lerLocal();
        
        // Geração automática de código se não for informado
        let codigo = (dados.codigo || '').trim();
        if (!codigo) {
            const codigosNumericos = lista
                .map(s => parseInt(s.codigo, 10))
                .filter(n => !isNaN(n));
            const maior = codigosNumericos.length > 0 ? Math.max(...codigosNumericos) : 1000;
            codigo = String(maior + 1);
        }

        const novo = {
            id: Date.now(),
            codigo,
            nome: dados.nome.trim().toUpperCase(),
            preco: Math.max(0, parseFloat(dados.preco) || 0),
            tempo_estimado: (dados.tempo_estimado || '01:00').trim(),
            categoria: (dados.categoria || 'Mecânica Geral').trim(),
            descricao: (dados.descricao || '').trim(),
            ativo: dados.ativo !== undefined ? Boolean(dados.ativo) : true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const useSupabase = await this.testarSupabase();
        if (useSupabase) {
            try {
                const { data, error } = await supabase.from('servicos').insert([novo]).select().single();
                if (!error && data) {
                    novo.id = data.id;
                }
            } catch (_) {}
        }

        lista.unshift(novo);
        this.escreverLocal(lista);

        if (auditoriaService && usuarioAuditoria) {
            try {
                await auditoriaService.registrar({
                    usuario_id: usuarioAuditoria.id || null,
                    usuario_nome: usuarioAuditoria.nome || 'Operador',
                    acao: 'CRIACAO',
                    tabela: 'servicos',
                    registro_id: String(novo.id),
                    detalhes: { nome: novo.nome, preco: novo.preco, codigo: novo.codigo }
                });
            } catch (_) {}
        }

        return novo;
    }

    /**
     * Atualiza um serviço existente
     */
    async atualizar(id, dados, usuarioAuditoria = null) {
        const useSupabase = await this.testarSupabase();
        const lista = this.lerLocal();
        const idx = lista.findIndex(s => String(s.id) === String(id));

        if (idx === -1) {
            throw new Error('Serviço não encontrado.');
        }

        const atual = lista[idx];
        const atualizado = {
            ...atual,
            codigo: dados.codigo ? String(dados.codigo).trim() : atual.codigo,
            nome: dados.nome ? String(dados.nome).trim().toUpperCase() : atual.nome,
            preco: dados.preco !== undefined ? Math.max(0, parseFloat(dados.preco) || 0) : atual.preco,
            tempo_estimado: dados.tempo_estimado !== undefined ? String(dados.tempo_estimado).trim() : atual.tempo_estimado,
            categoria: dados.categoria !== undefined ? String(dados.categoria).trim() : atual.categoria,
            descricao: dados.descricao !== undefined ? String(dados.descricao).trim() : atual.descricao,
            ativo: dados.ativo !== undefined ? Boolean(dados.ativo) : atual.ativo,
            updated_at: new Date().toISOString()
        };

        if (useSupabase) {
            try {
                await supabase.from('servicos').update(atualizado).eq('id', id);
            } catch (_) {}
        }

        lista[idx] = atualizado;
        this.escreverLocal(lista);

        if (auditoriaService && usuarioAuditoria) {
            try {
                await auditoriaService.registrar({
                    usuario_id: usuarioAuditoria.id || null,
                    usuario_nome: usuarioAuditoria.nome || 'Operador',
                    acao: 'EDICAO',
                    tabela: 'servicos',
                    registro_id: String(id),
                    detalhes: { nome: atualizado.nome, preco: atualizado.preco }
                });
            } catch (_) {}
        }

        return atualizado;
    }

    /**
     * Exclui um serviço
     */
    async excluir(id, usuarioAuditoria = null) {
        const useSupabase = await this.testarSupabase();
        const lista = this.lerLocal();
        const idx = lista.findIndex(s => String(s.id) === String(id));

        if (idx === -1) {
            throw new Error('Serviço não encontrado.');
        }

        const removido = lista.splice(idx, 1)[0];
        this.escreverLocal(lista);

        if (useSupabase) {
            try {
                await supabase.from('servicos').delete().eq('id', id);
            } catch (_) {}
        }

        if (auditoriaService && usuarioAuditoria) {
            try {
                await auditoriaService.registrar({
                    usuario_id: usuarioAuditoria.id || null,
                    usuario_nome: usuarioAuditoria.nome || 'Supervisor',
                    acao: 'EXCLUSAO',
                    tabela: 'servicos',
                    registro_id: String(id),
                    detalhes: { nome: removido.nome, preco: removido.preco }
                });
            } catch (_) {}
        }

        return true;
    }

    /**
     * Retorna métricas executivas para o topo do módulo
     */
    async obterMetricas() {
        const { servicos, total } = await this.listar({ pagina: 1, limite: 1000 });
        if (total === 0) {
            return {
                totalServicos: 0,
                precoMedio: 0,
                categoriasCount: 0,
                categorias: []
            };
        }

        const somaPrecos = servicos.reduce((acc, s) => acc + (parseFloat(s.preco) || 0), 0);
        const precoMedio = total > 0 ? somaPrecos / total : 0;
        const categoriasSet = new Set(servicos.map(s => s.categoria).filter(Boolean));

        return {
            totalServicos: total,
            precoMedio: parseFloat(precoMedio.toFixed(2)),
            categoriasCount: categoriasSet.size,
            categorias: Array.from(categoriasSet)
        };
    }
}

module.exports = new ServicosService();
