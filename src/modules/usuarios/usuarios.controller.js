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
}

module.exports = new UsuariosController();

