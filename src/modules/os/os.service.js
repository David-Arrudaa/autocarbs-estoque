/**
 * =========================================================
 * AUTOCAR BS - ERP OFICINA
 * Service: Gestão de Ordens de Serviço (OS)
 * =========================================================
 * Persistência híbrida resiliente:
 * 1. Supabase (tabela 'ordens_servico');
 * 2. Armazenamento JSON seguro em 'data/ordens_servico.json'.
 * =========================================================
 */

const fs = require('fs');
const path = require('path');
const { supabase } = require('../../config/supabase');
const auditoriaService = require('../auditoria/auditoria.service');

const FILE_PATH = path.join(__dirname, '../../../data/ordens_servico.json');

class OSService {
    constructor() {
        this.usarFallback = false;
        this.iniciarArquivoFallback();
    }

    iniciarArquivoFallback() {
        try {
            const dir = path.dirname(FILE_PATH);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            if (!fs.existsSync(FILE_PATH)) {
                fs.writeFileSync(FILE_PATH, JSON.stringify([], null, 2), 'utf-8');
            }
        } catch (err) {
            console.error('[OSService] Erro ao inicializar arquivo JSON de OS:', err.message);
        }
    }

    lerArquivoJSON() {
        try {
            if (!fs.existsSync(FILE_PATH)) return [];
            const data = fs.readFileSync(FILE_PATH, 'utf-8');
            return JSON.parse(data || '[]');
        } catch (err) {
            console.error('[OSService] Erro ao ler ordens_servico.json:', err.message);
            return [];
        }
    }

    salvarArquivoJSON(lista) {
        try {
            fs.writeFileSync(FILE_PATH, JSON.stringify(lista, null, 2), 'utf-8');
            return true;
        } catch (err) {
            console.error('[OSService] Erro ao gravar ordens_servico.json:', err.message);
            return false;
        }
    }

    /**
     * Normaliza os campos do registro para garantir compatibilidade entre
     * esquemas legados do Supabase e o novo padrão rico da AutoCar BS.
     */
    normalizarRegistro(os) {
        if (!os) return null;
        return {
            id: Number(os.id),
            numero: String(os.numero || os.id),
            cliente_id: os.cliente_id || null,
            cliente_nome: (os.cliente_nome || os.cliente || 'CLIENTE NÃO IDENTIFICADO').trim().toUpperCase(),
            cliente_telefone: os.cliente_telefone || '',
            veiculo_modelo: (os.veiculo_modelo || os.veiculo || '').trim().toUpperCase(),
            veiculo_placa: (os.veiculo_placa || os.placa || '').trim().toUpperCase(),
            veiculo_km: String(os.veiculo_km || ''),
            responsavel: (os.responsavel || 'AUTOCAR BS').trim().toUpperCase(),
            data_inicial: os.data_inicial || (os.created_at ? os.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
            data_final: os.data_final || '',
            valor_pecas: Number(os.valor_pecas) || 0,
            valor_servicos: Number(os.valor_servicos) || 0,
            valor_desconto: Number(os.valor_desconto) || 0,
            valor_total: Number(os.valor_total !== undefined ? os.valor_total : (os.total || 0)),
            status: (os.status || 'aberto').toLowerCase(),
            termo_garantia: os.termo_garantia || '90 dias',
            descricao_problema: os.descricao_problema || os.observacao || '',
            laudo_tecnico: os.laudo_tecnico || '',
            itens_pecas: Array.isArray(os.itens_pecas) ? os.itens_pecas : [],
            itens_servicos: Array.isArray(os.itens_servicos) ? os.itens_servicos : [],
            observacoes: os.observacoes || '',
            created_at: os.created_at || new Date().toISOString(),
            updated_at: os.updated_at || new Date().toISOString()
        };
    }

    /**
     * Lista ordens de serviço com paginação e filtros dinâmicos
     */
    async listar({ pagina = 1, limite = 15, busca = '', status = '', dataInicial = '', dataFinal = '', ordenarPor = 'id', ordem = 'desc' }) {
        const pag = Math.max(1, parseInt(pagina, 10) || 1);
        const lim = Math.max(1, Math.min(100, parseInt(limite, 10) || 15));

        // 1. Obtém dados do arquivo JSON local (contendo os dados reais da oficina)
        const locais = this.lerArquivoJSON().map(os => this.normalizarRegistro(os));
        const mapaRegistros = new Map();
        locais.forEach(os => mapaRegistros.set(String(os.id), os));

        // 2. Se o Supabase estiver disponível, agrega registros históricos remotos
        if (!this.usarFallback) {
            try {
                const { data, error } = await supabase
                    .from('ordens_servico')
                    .select('*');

                if (!error && Array.isArray(data)) {
                    data.forEach(item => {
                        const idStr = String(item.id);
                        if (!mapaRegistros.has(idStr)) {
                            mapaRegistros.set(idStr, this.normalizarRegistro(item));
                        }
                    });
                }
            } catch (_) {
                // Mantém funcionamento resiliente local
            }
        }

        let lista = Array.from(mapaRegistros.values());

        // 3. Filtro por Busca textual
        if (busca && busca.trim()) {
            const termo = busca.trim().toLowerCase();
            lista = lista.filter(os => {
                const num = String(os.numero || os.id || '').toLowerCase();
                const cli = String(os.cliente_nome || '').toLowerCase();
                const mod = String(os.veiculo_modelo || '').toLowerCase();
                const pla = String(os.veiculo_placa || '').toLowerCase();
                const resp = String(os.responsavel || '').toLowerCase();
                return num.includes(termo) || cli.includes(termo) || mod.includes(termo) || pla.includes(termo) || resp.includes(termo);
            });
        }

        // 4. Filtro por Status
        if (status && status !== 'todos') {
            lista = lista.filter(os => os.status === status);
        }

        // 5. Filtro por Intervalo de Datas
        if (dataInicial) {
            lista = lista.filter(os => (os.data_inicial || '') >= dataInicial);
        }

        if (dataFinal) {
            lista = lista.filter(os => (os.data_inicial || '') <= dataFinal);
        }

        // 6. Ordenação
        lista.sort((a, b) => {
            let valA = a[ordenarPor] !== undefined ? a[ordenarPor] : a.id;
            let valB = b[ordenarPor] !== undefined ? b[ordenarPor] : b.id;

            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return ordem === 'asc' ? -1 : 1;
            if (valA > valB) return ordem === 'asc' ? 1 : -1;
            return 0;
        });

        const total = lista.length;
        const totalPaginas = Math.ceil(total / lim) || 1;
        const inicio = (pag - 1) * lim;
        const paginados = lista.slice(inicio, inicio + lim);

        return {
            ordens: paginados,
            total,
            pagina: pag,
            limite: lim,
            totalPaginas
        };
    }

    /**
     * Obtém uma OS completa por ID ou Número
     */
    async obterPorId(id) {
        const idStr = String(id);
        const locais = this.lerArquivoJSON();
        const encontradoLocal = locais.find(os => String(os.id) === idStr || String(os.numero) === idStr);
        if (encontradoLocal) {
            return this.normalizarRegistro(encontradoLocal);
        }

        if (!this.usarFallback) {
            try {
                const { data, error } = await supabase
                    .from('ordens_servico')
                    .select('*')
                    .or(`id.eq.${id},numero.eq.${id}`)
                    .maybeSingle();

                if (!error && data) return this.normalizarRegistro(data);
            } catch (_) {}
        }

        return null;
    }

    /**
     * Cria ou atualiza uma Ordem de Serviço
     */
    async salvar(dados, usuarioId = null) {
        const agora = new Date().toISOString();
        const lista = this.lerArquivoJSON();

        // Cálculo de totais
        const itensPecas = Array.isArray(dados.itens_pecas) ? dados.itens_pecas : [];
        const itensServicos = Array.isArray(dados.itens_servicos) ? dados.itens_servicos : [];

        const valorPecas = itensPecas.reduce((acc, p) => acc + (Number(p.subtotal) || (Number(p.qtd || 1) * Number(p.preco || 0))), 0);
        const valorServicos = itensServicos.reduce((acc, s) => acc + (Number(s.subtotal) || Number(s.preco || 0)), 0);
        const valorDesconto = Math.max(0, Number(dados.valor_desconto) || 0);
        const valorTotal = Math.max(0, (Number(dados.valor_total) || (valorPecas + valorServicos)) - valorDesconto);

        if (dados.id) {
            // Edição
            const index = lista.findIndex(os => String(os.id) === String(dados.id));
            if (index === -1) {
                throw new Error('Ordem de serviço não encontrada para edição.');
            }

            const registroAntigo = lista[index];
            const atualizado = {
                ...registroAntigo,
                ...dados,
                id: registroAntigo.id,
                numero: String(dados.numero || registroAntigo.numero || registroAntigo.id),
                valor_pecas: valorPecas,
                valor_servicos: valorServicos,
                valor_desconto: valorDesconto,
                valor_total: valorTotal,
                updated_at: agora
            };

            lista[index] = atualizado;
            this.salvarArquivoJSON(lista);

            if (!this.usarFallback) {
                try {
                    await supabase.from('ordens_servico').update(atualizado).eq('id', registroAntigo.id);
                } catch (_) {}
            }

            auditoriaService.registrar({
                usuario: { id: usuarioId },
                acao: 'EDICAO',
                tabela: 'ordens_servico',
                registroId: atualizado.id,
                detalhes: { numero: atualizado.numero, cliente: atualizado.cliente_nome, status: atualizado.status }
            }).catch(() => {});

            return atualizado;
        } else {
            // Nova OS: gera próximo ID e Número sequencial
            const maxId = lista.reduce((max, os) => Math.max(max, Number(os.id) || 0), 1350);
            const novoId = maxId + 1;
            const numeroOS = String(dados.numero || novoId);

            const novaOS = {
                id: novoId,
                numero: numeroOS,
                cliente_id: dados.cliente_id ? Number(dados.cliente_id) : null,
                cliente_nome: (dados.cliente_nome || 'CLIENTE NÃO IDENTIFICADO').trim().toUpperCase(),
                cliente_telefone: (dados.cliente_telefone || '').trim(),
                veiculo_modelo: (dados.veiculo_modelo || '').trim().toUpperCase(),
                veiculo_placa: (dados.veiculo_placa || '').trim().toUpperCase(),
                veiculo_km: (dados.veiculo_km || '').trim(),
                responsavel: (dados.responsavel || 'AUTOCAR BS').trim(),
                data_inicial: dados.data_inicial || agora.split('T')[0],
                data_final: dados.data_final || '',
                valor_pecas: valorPecas,
                valor_servicos: valorServicos,
                valor_desconto: valorDesconto,
                valor_total: valorTotal,
                status: dados.status || 'orcamento',
                termo_garantia: dados.termo_garantia || '90 dias',
                descricao_problema: (dados.descricao_problema || '').trim(),
                laudo_tecnico: (dados.laudo_tecnico || '').trim(),
                itens_pecas: itensPecas,
                itens_servicos: itensServicos,
                observacoes: (dados.observacoes || '').trim(),
                created_at: agora,
                updated_at: agora
            };

            lista.unshift(novaOS);
            this.salvarArquivoJSON(lista);

            if (!this.usarFallback) {
                try {
                    await supabase.from('ordens_servico').insert([novaOS]);
                } catch (_) {}
            }

            auditoriaService.registrar({
                usuario: { id: usuarioId },
                acao: 'CRIACAO',
                tabela: 'ordens_servico',
                registroId: novaOS.id,
                detalhes: { numero: novaOS.numero, cliente: novaOS.cliente_nome, status: novaOS.status }
            }).catch(() => {});

            return novaOS;
        }
    }

    /**
     * Exclui uma OS
     */
    async excluir(id, usuarioId = null) {
        const lista = this.lerArquivoJSON();
        const index = lista.findIndex(os => String(os.id) === String(id) || String(os.numero) === String(id));

        if (index === -1) {
            throw new Error('Ordem de serviço não encontrada para exclusão.');
        }

        const removido = lista.splice(index, 1)[0];
        this.salvarArquivoJSON(lista);

        if (!this.usarFallback) {
            try {
                await supabase.from('ordens_servico').delete().eq('id', removido.id);
            } catch (_) {}
        }

        auditoriaService.registrar({
            usuario: { id: usuarioId },
            acao: 'EXCLUSAO',
            tabela: 'ordens_servico',
            registroId: removido.id,
            detalhes: { numero: removido.numero, cliente: removido.cliente_nome }
        }).catch(() => {});

        return true;
    }
}

module.exports = new OSService();
