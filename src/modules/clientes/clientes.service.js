/**
 * =========================================================
 * AUTOCAR BS - ERP OFICINA
 * Service: Gestão de Clientes & Veículos
 * =========================================================
 * Integração com a base de dados dedicada de clientes (Supabase 2).
 */

const { supabase, supabaseClientes } = require('../../config/supabase');
const auditoriaService = require('../auditoria/auditoria.service');
const osService = require('../os/os.service');

function escaparIlike(valor) {
    return String(valor).replace(/[\\%_]/g, (c) => `\\${c}`);
}

class ClientesService {
    /**
     * Lista clientes com veículos vinculados, suporte a busca e paginação
     */
    async listar({ busca = '', pagina = 1, limite = 15, ordenarPor = 'nome', ordem = 'asc' }) {
        const termoBusca = (busca || '').trim();
        const page = Math.max(1, parseInt(pagina) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(limite) || 15));
        const offset = (page - 1) * limit;

        let query = supabaseClientes
            .from('clientes')
            .select('*, veiculos(*)', { count: 'exact' });

        if (termoBusca) {
            const safe = escaparIlike(termoBusca);
            // Busca por nome, CPF ou telefone no cliente
            query = query.or(`nome.ilike.%${safe}%,cpf.ilike.%${safe}%,telefone.ilike.%${safe}%`);
        }

        // Ordenação
        const ascending = ordem.toLowerCase() === 'asc';
        query = query.order(ordenarPor, { ascending });

        // Paginação
        query = query.range(offset, offset + limit - 1);

        const { data, count, error } = await query;
        if (error) throw error;

        // Se a busca principal por cliente não retornou nada, tenta verificar se o termo era uma placa
        let clientesFinais = data || [];
        let totalCount = count || 0;

        // Se houver termo de busca, também verifica se o termo corresponde a alguma placa de veículo
        if (termoBusca) {
            try {
                const safe = escaparIlike(termoBusca);
                const limpoPlaca = termoBusca.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

                let condicoesPlaca = [`placa.ilike.%${safe}%`];
                if (limpoPlaca && limpoPlaca !== termoBusca.toUpperCase()) {
                    condicoesPlaca.push(`placa.ilike.%${escaparIlike(limpoPlaca)}%`);
                }
                if (limpoPlaca.length >= 3) {
                    const comHifen = limpoPlaca.slice(0, 3) + '-' + limpoPlaca.slice(3);
                    condicoesPlaca.push(`placa.ilike.%${escaparIlike(comHifen)}%`);
                }

                const { data: veiculosMatch } = await supabaseClientes
                    .from('veiculos')
                    .select('cliente_id')
                    .or(condicoesPlaca.join(','));

                if (veiculosMatch && veiculosMatch.length > 0) {
                    const clientIds = [...new Set(veiculosMatch.map(v => v.cliente_id))];
                    const existingIds = new Set(clientesFinais.map(c => c.id));
                    const missingIds = clientIds.filter(id => !existingIds.has(id));

                    if (missingIds.length > 0) {
                        const { data: clientesPorPlaca } = await supabaseClientes
                            .from('clientes')
                            .select('*, veiculos(*)')
                            .in('id', missingIds);

                        if (clientesPorPlaca && clientesPorPlaca.length > 0) {
                            clientesFinais = [...clientesFinais, ...clientesPorPlaca];
                            totalCount += clientesPorPlaca.length;
                        }
                    }
                }
            } catch (_) {}
        }

        // Higieniza e deduplica veículos por placa e clientes por ID
        const mapaClientes = new Map();
        clientesFinais.forEach(c => {
            if (!c) return;
            const clienteId = c.id;
            if (mapaClientes.has(clienteId)) return;

            const veiculosOriginais = Array.isArray(c.veiculos) ? c.veiculos : [];
            const placasVistas = new Set();
            const veiculosUnicos = [];

            veiculosOriginais.forEach(v => {
                const placaNorm = String(v.placa || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                const chave = placaNorm || String(v.modelo || '').trim().toUpperCase();
                if (chave && !placasVistas.has(chave)) {
                    placasVistas.add(chave);
                    veiculosUnicos.push(v);
                }
            });

            mapaClientes.set(clienteId, {
                ...c,
                veiculos: veiculosUnicos
            });
        });

        const clientesDeduplicados = Array.from(mapaClientes.values());

        return {
            clientes: clientesDeduplicados,
            paginacao: {
                total: totalCount,
                pagina: page,
                limite: limit,
                totalPaginas: Math.ceil(totalCount / limit) || 1
            }
        };
    }

    /**
     * Obtém um cliente por ID com veículos e histórico recente de OS/checklists
     */
    async obterPorId(id) {
        const { data: cliente, error } = await supabaseClientes
            .from('clientes')
            .select('*, veiculos(*)')
            .eq('id', id)
            .single();

        if (error) throw error;
        if (!cliente) return null;

        // 1. Busca histórico de checklists desse cliente no banco de clientes
        let historico_checklists = [];
        try {
            const { data: checklists } = await supabaseClientes
                .from('historico_checklists')
                .select('*')
                .ilike('cliente_nome', `%${escaparIlike(cliente.nome)}%`)
                .order('created_at', { ascending: false })
                .limit(50);

            historico_checklists = checklists || [];
        } catch (_) {}

        // 2. Busca histórico de Ordens de Serviço (OS) através do osService
        let ordens_servico = [];
        try {
            const todasOSRes = await osService.listar({ limite: 1000 });
            const todasOS = todasOSRes?.ordens || [];

            const clienteIdStr = String(cliente.id);
            const nomeClienteNorm = (cliente.nome || '').trim().toUpperCase();
            const placasCliente = new Set(
                (cliente.veiculos || [])
                    .map(v => (v.placa || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase())
                    .filter(Boolean)
            );

            ordens_servico = todasOS.filter(os => {
                // Match por cliente_id
                if (os.cliente_id && String(os.cliente_id) === clienteIdStr) {
                    return true;
                }
                // Match por nome do cliente
                const osNome = (os.cliente_nome || '').trim().toUpperCase();
                if (osNome && nomeClienteNorm) {
                    if (osNome.includes(nomeClienteNorm) || nomeClienteNorm.includes(osNome)) {
                        return true;
                    }
                }
                // Match por placa vinculada aos veículos do cliente
                const placaOs = (os.veiculo_placa || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                if (placaOs && placasCliente.has(placaOs)) {
                    return true;
                }
                return false;
            }).map(os => ({
                ...os,
                veiculo: os.veiculo_modelo || os.veiculo || 'VEÍCULO NÃO INFORMADO',
                placa: os.veiculo_placa || os.placa || '-',
                total: os.valor_total !== undefined ? os.valor_total : (os.total || 0),
                os_itens: Array.isArray(os.os_itens) && os.os_itens.length > 0
                    ? os.os_itens
                    : [...(os.itens_pecas || []).map(p => ({ descricao: p.nome || p.descricao, quantidade: p.qtd || 1, valor_unitario: p.preco || 0, valor_total: (p.qtd || 1) * (p.preco || 0) })),
                       ...(os.itens_servicos || []).map(s => ({ descricao: s.nome || s.descricao, quantidade: 1, valor_unitario: s.preco || 0, valor_total: s.preco || 0 }))]
            }));
        } catch (err) {
            console.error('[ClientesService] Erro ao buscar OS vinculadas:', err.message);
        }

        return {
            ...cliente,
            historico: historico_checklists, // compatibilidade
            historico_checklists,
            ordens_servico
        };
    }

    /**
     * Cria ou atualiza um cliente com seus veículos
     */
    async salvar(dados, usuarioSessao) {
        const id = dados.id ? parseInt(dados.id) : null;
        const nome = (dados.nome || '').trim().toUpperCase();
        const cpf = (dados.cpf || '').trim();
        const telefone = (dados.telefone || '').trim();
        const cep = (dados.cep || '').trim();
        const endereco = (dados.endereco || '').trim().toUpperCase();
        const numero = (dados.numero || '').trim();
        const bairro = (dados.bairro || '').trim().toUpperCase();
        const cidade = (dados.cidade || '').trim().toUpperCase();
        const uf = (dados.uf || '').trim().toUpperCase();
        const veiculos = Array.isArray(dados.veiculos) ? dados.veiculos : [];

        if (!nome) {
            const erro = new Error('Nome do cliente é obrigatório.');
            erro.status = 400;
            throw erro;
        }

        // Validação de unicidade de CPF (se informado)
        if (cpf) {
            let queryCpf = supabaseClientes
                .from('clientes')
                .select('id, nome')
                .eq('cpf', cpf);

            if (id) {
                queryCpf = queryCpf.neq('id', id);
            }

            const { data: conflito } = await queryCpf.maybeSingle();
            if (conflito) {
                const erro = new Error(`Este CPF já pertence ao cliente: ${conflito.nome}`);
                erro.status = 409;
                throw erro;
            }
        }

        let clienteIdFinal = id;

        if (!id) {
            // INSERT
            const { data: novoCliente, error: errInsert } = await supabaseClientes
                .from('clientes')
                .insert([{ nome, cpf, telefone, cep, endereco, numero, bairro, cidade, uf }])
                .select()
                .single();

            if (errInsert) throw errInsert;
            clienteIdFinal = novoCliente.id;

            try {
                auditoriaService.registrar({
                    usuario: usuarioSessao,
                    acao: 'CRIAR_CLIENTE',
                    tabela: 'clientes',
                    registroId: clienteIdFinal,
                    detalhes: { nome, cpf, telefone }
                });
            } catch (_) {}
        } else {
            // UPDATE
            const { error: errUpdate } = await supabaseClientes
                .from('clientes')
                .update({ nome, cpf, telefone, cep, endereco, numero, bairro, cidade, uf })
                .eq('id', id);

            if (errUpdate) throw errUpdate;

            // Remove veículos antigos para reinserir lista atualizada
            await supabaseClientes
                .from('veiculos')
                .delete()
                .eq('cliente_id', clienteIdFinal);

            try {
                auditoriaService.registrar({
                    usuario: usuarioSessao,
                    acao: 'ATUALIZAR_CLIENTE',
                    tabela: 'clientes',
                    registroId: clienteIdFinal,
                    detalhes: { nome, cpf, telefone }
                });
            } catch (_) {}
        }

        // Insere veículos vinculados
        if (veiculos.length > 0) {
            const veiculosFormatados = veiculos.map(v => ({
                cliente_id: clienteIdFinal,
                placa: (v.placa || '').toUpperCase().trim(),
                chassi: (v.chassi || '').toUpperCase().trim(),
                marca: (v.marca || '').toUpperCase().trim(),
                modelo: (v.modelo || '').toUpperCase().trim(),
                ano: (v.ano || '').trim(),
                cor: (v.cor || '').toUpperCase().trim(),
                combustivel: (v.combustivel || '').toUpperCase().trim()
            })).filter(v => !!v.placa);

            if (veiculosFormatados.length > 0) {
                const { error: errVeiculos } = await supabaseClientes
                    .from('veiculos')
                    .insert(veiculosFormatados);

                if (errVeiculos) throw errVeiculos;
            }
        }

        return this.obterPorId(clienteIdFinal);
    }

    /**
     * Exclui um cliente por ID (remove veículos em cascata se configurado)
     */
    async excluir(id, usuarioSessao) {
        const cliente = await this.obterPorId(id);
        if (!cliente) {
            const erro = new Error('Cliente não encontrado.');
            erro.status = 404;
            throw erro;
        }

        // Deleta os veículos primeiro por precaução caso não haja cascade nativo
        await supabaseClientes.from('veiculos').delete().eq('cliente_id', id);

        const { error } = await supabaseClientes
            .from('clientes')
            .delete()
            .eq('id', id);

        if (error) throw error;

        try {
            auditoriaService.registrar({
                usuario: usuarioSessao,
                acao: 'EXCLUIR_CLIENTE',
                tabela: 'clientes',
                registroId: id,
                detalhes: { nome: cliente.nome, cpf: cliente.cpf }
            });
        } catch (_) {}

        return { success: true, id };
    }

    /**
     * Retorna indicadores para o dashboard do módulo de clientes
     */
    async obterMetricas() {
        const [cCount, vCount, hCount] = await Promise.all([
            supabaseClientes.from('clientes').select('*', { count: 'exact', head: true }),
            supabaseClientes.from('veiculos').select('*', { count: 'exact', head: true }),
            supabaseClientes.from('historico_checklists').select('*', { count: 'exact', head: true })
        ]);

        return {
            totalClientes: cCount.count || 0,
            totalVeiculos: vCount.count || 0,
            totalChecklists: hCount.count || 0
        };
    }
}

module.exports = new ClientesService();
