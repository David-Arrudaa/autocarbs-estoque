const supabase = require('../../config/supabase');
const auditoriaService = require('../auditoria/auditoria.service');

class CotacoesController {
    /**
     * Lista o histórico de orçamentos e cotações arquivadas
     */
    async listar(req, res, next) {
        try {
            const busca = (req.query.busca || '').trim().toUpperCase();
            let query = supabase
                .from('cotacoes')
                .select('id, placa, modelo, valor_total, criado_em, atualizado_em, usuario_id')
                .order('criado_em', { ascending: false });

            if (busca) {
                query = query.or(`placa.ilike.%${busca}%,modelo.ilike.%${busca}%`);
            }

            const { data, error } = await query.limit(100);

            if (error) {
                // Tolerância se a tabela ainda não foi criada no Supabase
                if (error.code === '42P01' || error.message?.includes('schema cache')) {
                    return res.json({
                        success: true,
                        data: [],
                        aviso: 'Tabela de cotações ainda não criada no Supabase. Os orçamentos continuam salvos no navegador.'
                    });
                }
                throw error;
            }

            return res.json({
                success: true,
                data: data || []
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Obtém os detalhes completos de uma cotação por ID (incluindo JSON do estado)
     */
    async obterPorId(req, res, next) {
        try {
            const { id } = req.params;
            const { data, error } = await supabase
                .from('cotacoes')
                .select('*')
                .eq('id', id)
                .single();

            if (error || !data) {
                return res.status(404).json({ success: false, error: 'Orçamento não encontrado.' });
            }

            return res.json({
                success: true,
                data
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Salva ou atualiza um orçamento no banco de dados centralizado
     */
    async salvar(req, res, next) {
        try {
            const { id, placa, modelo, valorTotal, dados } = req.body;

            const placaFmt = String(placa || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
            const modeloFmt = String(modelo || '').trim().toUpperCase().substring(0, 120);

            if (!modeloFmt) {
                return res.status(400).json({ success: false, error: 'O modelo do veículo é obrigatório.' });
            }

            const payload = {
                placa: placaFmt || 'SEM PLACA',
                modelo: modeloFmt,
                valor_total: Math.max(0, parseFloat(valorTotal) || 0),
                dados: dados || {},
                usuario_id: req.user?.id && String(req.user.id).length === 36 ? req.user.id : null,
                atualizado_em: new Date().toISOString()
            };

            let resultado = null;

            // Se id UUID válido foi fornecido, tenta atualizar
            if (id && String(id).length === 36) {
                const { data, error } = await supabase
                    .from('cotacoes')
                    .update(payload)
                    .eq('id', id)
                    .select();

                if (!error && data && data.length > 0) {
                    resultado = data[0];
                }
            }

            // Se não atualizou, insere novo registro
            if (!resultado) {
                payload.criado_em = new Date().toISOString();
                const { data, error } = await supabase
                    .from('cotacoes')
                    .insert([payload])
                    .select();

                if (error) {
                    if (error.code === '42P01' || error.message?.includes('schema cache')) {
                        return res.json({
                            success: true,
                            salvoLocal: true,
                            message: 'Orçamento salvo localmente. Execute a migração SQL para persistir no Supabase.'
                        });
                    }
                    throw error;
                }

                resultado = data ? data[0] : null;
            }

            auditoriaService.registrar({
                usuario: req.user,
                acao: 'CRIACAO',
                tabela: 'cotacoes',
                registroId: resultado?.id,
                detalhes: { placa: payload.placa, modelo: payload.modelo, total: payload.valor_total }
            });

            return res.json({
                success: true,
                data: resultado,
                message: 'Orçamento gravado com sucesso no servidor!'
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Exclui um orçamento do histórico
     */
    async excluir(req, res, next) {
        try {
            const { id } = req.params;

            const { error } = await supabase
                .from('cotacoes')
                .delete()
                .eq('id', id);

            if (error) throw error;

            auditoriaService.registrar({
                usuario: req.user,
                acao: 'EXCLUSAO',
                tabela: 'cotacoes',
                registroId: id
            });

            return res.json({
                success: true,
                message: 'Orçamento removido com sucesso!'
            });
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new CotacoesController();

