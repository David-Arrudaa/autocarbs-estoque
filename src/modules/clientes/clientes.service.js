/**
 * =========================================================
 * AUTOCAR BS - ERP OFICINA
 * Service: Gestão de Clientes & Veículos
 * =========================================================
 * Integração com a base de dados dedicada de clientes (Supabase 2).
 */

const { supabaseClientes } = require('../../config/supabase');
const auditoriaService = require('../auditoria/auditoria.service');

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

        if (termoBusca && clientesFinais.length === 0) {
            const safe = escaparIlike(termoBusca);
            const { data: veiculosMatch } = await supabaseClientes
                .from('veiculos')
                .select('cliente_id')
                .ilike('placa', `%${safe}%`);

            if (veiculosMatch && veiculosMatch.length > 0) {
                const clientIds = [...new Set(veiculosMatch.map(v => v.cliente_id))];
                const { data: clientesPorPlaca, count: countPlaca } = await supabaseClientes
                    .from('clientes')
                    .select('*, veiculos(*)', { count: 'exact' })
                    .in('id', clientIds)
                    .order('nome', { ascending: true });

                clientesFinais = clientesPorPlaca || [];
                totalCount = countPlaca || clientesFinais.length;
            }
        }

        return {
            clientes: clientesFinais,
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

        // Busca histórico de checklists desse cliente
        let historico = [];
        try {
            const { data: checklists } = await supabaseClientes
                .from('historico_checklists')
                .select('*')
                .ilike('cliente_nome', `%${escaparIlike(cliente.nome)}%`)
                .order('created_at', { ascending: false })
                .limit(20);

            historico = checklists || [];
        } catch (_) {}

        return {
            ...cliente,
            historico
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

            auditoriaService.registrarLog({
                usuario_id: usuarioSessao?.id,
                acao: 'CRIAR_CLIENTE',
                tabela: 'clientes',
                registro_id: clienteIdFinal,
                dados_novos: { nome, cpf, telefone }
            });
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

            auditoriaService.registrarLog({
                usuario_id: usuarioSessao?.id,
                acao: 'ATUALIZAR_CLIENTE',
                tabela: 'clientes',
                registro_id: clienteIdFinal,
                dados_novos: { nome, cpf, telefone }
            });
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

        auditoriaService.registrarLog({
            usuario_id: usuarioSessao?.id,
            acao: 'EXCLUIR_CLIENTE',
            tabela: 'clientes',
            registro_id: id,
            dados_anteriores: { nome: cliente.nome, cpf: cliente.cpf }
        });

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
