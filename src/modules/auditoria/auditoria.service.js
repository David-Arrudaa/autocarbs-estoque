const supabase = require('../../config/supabase');

class AuditoriaService {
    /**
     * Registra uma ação na trilha de auditoria do ERP.
     * Desenvolvido com tolerância a falhas: não interrompe a operação principal
     * caso a tabela 'auditoria' ainda não tenha sido criada no banco.
     *
     * @param {Object} params
     * @param {Object} [params.usuario] - Objeto do usuário autenticado (req.user)
     * @param {string} params.acao - 'CRIACAO' | 'EDICAO' | 'ENTRADA' | 'SAIDA' | 'EXCLUSAO' | 'COTACAO_SYNC'
     * @param {string} params.tabela - Nome da tabela afetada (ex: 'produtos', 'cotacoes')
     * @param {string|number} [params.registroId] - ID do registro afetado
     * @param {Object} [params.detalhes] - Objeto JSON com dados anteriores, novos ou detalhes da ação
     */
    async registrar({ usuario, acao, tabela, registroId, detalhes }) {
        const usuarioNome = usuario?.nome || 'Operador Padrão';
        const usuarioId = usuario?.id && String(usuario.id).length === 36 ? usuario.id : null;

        const payload = {
            usuario_id: usuarioId,
            usuario_nome: usuarioNome,
            acao,
            tabela,
            registro_id: registroId ? String(registroId) : null,
            detalhes: detalhes || null,
            criado_em: new Date().toISOString()
        };

        try {
            const { error } = await supabase.from('auditoria').insert([payload]);
            if (error) {
                // Se a tabela ainda não existe no Supabase, apenas loga aviso discreto
                if (error.code === '42P01' || error.message?.includes('schema cache')) {
                    // Tabela ainda não migrada
                    return;
                }
                console.warn('[Auditoria] Falha ao registrar log:', error.message);
            }
        } catch (err) {
            console.warn('[Auditoria] Erro de rede ou conexão:', err.message);
        }
    }
}

module.exports = new AuditoriaService();

