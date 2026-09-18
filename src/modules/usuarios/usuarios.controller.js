const bcrypt = require('bcryptjs');
const supabase = require('../../config/supabase');
const auditoriaService = require('../auditoria/auditoria.service');

class UsuariosController {
    /**
     * Lista todos os usuários cadastrados (sem expor pin_hash)
     */
    async listar(req, res, next) {
        try {
            const { data, error } = await supabase
                .from('usuarios')
                .select('id, nome, role, ativo, criado_em')
                .order('criado_em', { ascending: true });

            if (error) {
                if (error.code === '42P01' || error.message?.includes('schema cache')) {
                    return res.json({
                        success: true,
                        data: [],
                        aviso: 'Tabela de usuários ainda não criada no Supabase. Execute o script supabase_migration_fase2.sql.'
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
     * Cadastra um novo usuário com PIN hash (bcrypt)
     */
    async criar(req, res, next) {
        try {
            const { nome, pin, role } = req.body;

            if (!nome || !String(nome).trim()) {
                return res.status(400).json({ success: false, error: 'O nome do usuário é obrigatório.' });
            }

            if (!pin || String(pin).trim().length < 4) {
                return res.status(400).json({ success: false, error: 'O PIN deve ter no mínimo 4 dígitos.' });
            }

            const roleFmt = ['operador', 'supervisor', 'admin'].includes(role) ? role : 'operador';
            const pinHash = await bcrypt.hash(String(pin).trim(), 10);

            const novoUsuario = {
                nome: String(nome).trim().substring(0, 100),
                pin_hash: pinHash,
                role: roleFmt,
                ativo: true
            };

            const { data, error } = await supabase
                .from('usuarios')
                .insert([novoUsuario])
                .select('id, nome, role, ativo, criado_em');

            if (error) throw error;

            const criado = data ? data[0] : null;

            auditoriaService.registrar({
                usuario: req.user,
                acao: 'CRIACAO',
                tabela: 'usuarios',
                registroId: criado?.id,
                detalhes: { nome: novoUsuario.nome, role: novoUsuario.role }
            });

            return res.status(201).json({
                success: true,
                data: criado,
                message: 'Usuário cadastrado com sucesso!'
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Ativa ou desativa um usuário
     */
    async alternarStatus(req, res, next) {
        try {
            const { id } = req.params;
            const { ativo } = req.body;

            const { data, error } = await supabase
                .from('usuarios')
                .update({ ativo: Boolean(ativo) })
                .eq('id', id)
                .select('id, nome, role, ativo');

            if (error) throw error;

            auditoriaService.registrar({
                usuario: req.user,
                acao: 'EDICAO',
                tabela: 'usuarios',
                registroId: id,
                detalhes: { ativo: Boolean(ativo) }
            });

            return res.json({
                success: true,
                data: data ? data[0] : null,
                message: `Usuário ${Boolean(ativo) ? 'ativado' : 'desativado'} com sucesso!`
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Altera o PIN de acesso de um colaborador
     */
    async alterarPin(req, res, next) {
        try {
            const { id } = req.params;
            const { pin } = req.body;

            if (!pin || String(pin).trim().length < 4) {
                return res.status(400).json({ success: false, error: 'O novo PIN deve ter no mínimo 4 dígitos.' });
            }

            const pinHash = await bcrypt.hash(String(pin).trim(), 10);

            const { data, error } = await supabase
                .from('usuarios')
                .update({ pin_hash: pinHash })
                .eq('id', id)
                .select('id, nome, role, ativo');

            if (error) throw error;

            if (!data || data.length === 0) {
                return res.status(404).json({ success: false, error: 'Usuário não encontrado.' });
            }

            auditoriaService.registrar({
                usuario: req.user,
                acao: 'EDICAO',
                tabela: 'usuarios',
                registroId: id,
                detalhes: { campo: 'pin_alterado', usuarioAfetado: data[0].nome }
            });

            return res.json({
                success: true,
                message: `PIN de ${data[0].nome} alterado com sucesso!`
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Exclui um colaborador do sistema
     */
    async excluir(req, res, next) {
        try {
            const { id } = req.params;

            // Impede auto-exclusão do próprio usuário autenticado
            if (req.user && req.user.id === id) {
                return res.status(400).json({ success: false, error: 'Você não pode excluir o seu próprio usuário logado.' });
            }

            const { data: usuarioExistente } = await supabase
                .from('usuarios')
                .select('id, nome, role')
                .eq('id', id)
                .single();

            const { error } = await supabase
                .from('usuarios')
                .delete()
                .eq('id', id);

            if (error) throw error;

            auditoriaService.registrar({
                usuario: req.user,
                acao: 'EXCLUSAO',
                tabela: 'usuarios',
                registroId: id,
                detalhes: { usuarioExcluido: usuarioExistente?.nome || id }
            });

            return res.json({
                success: true,
                message: 'Usuário excluído com sucesso!'
            });
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new UsuariosController();

