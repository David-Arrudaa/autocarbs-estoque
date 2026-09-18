const bcrypt = require('bcryptjs');
const supabase = require('../../config/supabase');
const auditoriaService = require('../auditoria/auditoria.service');

class UsuariosController {
    /**
     * Lista todos os usuários cadastrados (sem expor hashes de senha)
     */
    async listar(req, res, next) {
        try {
            const { data, error } = await supabase
                .from('usuarios')
                .select('id, nome, email, role, ativo, criado_em')
                .order('criado_em', { ascending: true });

            if (error) {
                if (error.code === '42P01' || error.message?.includes('schema cache')) {
                    return res.json({
                        success: true,
                        data: [],
                        aviso: 'Tabela de usuários ainda não criada no Supabase.'
                    });
                }
                // Caso a coluna email ainda não exista, tenta sem a coluna email para compatibilidade
                if (error.message?.includes('email')) {
                    const fallbackQuery = await supabase
                        .from('usuarios')
                        .select('id, nome, role, ativo, criado_em')
                        .order('criado_em', { ascending: true });
                    return res.json({
                        success: true,
                        data: fallbackQuery.data || []
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
     * Cadastra um novo usuário com E-mail e Senha (bcrypt)
     */
    async criar(req, res, next) {
        try {
            const { nome, email, senha, pin, role } = req.body;
            const senhaRecebida = senha || pin;

            if (!nome || !String(nome).trim()) {
                return res.status(400).json({ success: false, error: 'O nome do colaborador é obrigatório.' });
            }

            const emailFmt = String(email || '').trim().toLowerCase();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailFmt || !emailRegex.test(emailFmt)) {
                return res.status(400).json({ success: false, error: 'Informe um e-mail válido (ex: colaborador@autocarbs.com.br).' });
            }

            if (!senhaRecebida || String(senhaRecebida).trim().length < 6) {
                return res.status(400).json({ success: false, error: 'A senha de acesso deve ter no mínimo 6 caracteres.' });
            }

            // Verifica se o e-mail já existe
            const { data: usuarioExistente } = await supabase
                .from('usuarios')
                .select('id')
                .eq('email', emailFmt)
                .maybeSingle();

            if (usuarioExistente) {
                return res.status(400).json({ success: false, error: 'Já existe um colaborador cadastrado com este e-mail.' });
            }

            const roleFmt = ['operador', 'supervisor', 'admin'].includes(role) ? role : 'operador';
            const senhaHash = await bcrypt.hash(String(senhaRecebida).trim(), 10);

            const novoUsuario = {
                nome: String(nome).trim().substring(0, 100),
                email: emailFmt,
                senha_hash: senhaHash,
                pin_hash: senhaHash,
                role: roleFmt,
                ativo: true
            };

            const { data, error } = await supabase
                .from('usuarios')
                .insert([novoUsuario])
                .select('id, nome, email, role, ativo, criado_em');

            if (error) throw error;

            const criado = data ? data[0] : null;

            auditoriaService.registrar({
                usuario: req.user,
                acao: 'CRIACAO',
                tabela: 'usuarios',
                registroId: criado?.id,
                detalhes: { nome: novoUsuario.nome, email: novoUsuario.email, role: novoUsuario.role }
            });

            return res.status(201).json({
                success: true,
                data: criado,
                message: 'Colaborador cadastrado com sucesso!'
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Atualiza os dados de um colaborador (Apenas Perfil Administrador)
     */
    async atualizar(req, res, next) {
        try {
            const { id } = req.params;
            const { nome, email, role, ativo, senha } = req.body;

            if (!nome || !String(nome).trim()) {
                return res.status(400).json({ success: false, error: 'O nome do colaborador é obrigatório.' });
            }

            const emailFmt = String(email || '').trim().toLowerCase();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailFmt || !emailRegex.test(emailFmt)) {
                return res.status(400).json({ success: false, error: 'Informe um e-mail válido.' });
            }

            // Verifica se o e-mail pertence a outro usuário
            const { data: usuarioExistente } = await supabase
                .from('usuarios')
                .select('id')
                .eq('email', emailFmt)
                .neq('id', id)
                .maybeSingle();

            if (usuarioExistente) {
                return res.status(400).json({ success: false, error: 'Já existe outro colaborador cadastrado com este e-mail.' });
            }

            const updateData = {
                nome: String(nome).trim().substring(0, 100),
                email: emailFmt
            };

            if (['operador', 'supervisor', 'admin'].includes(role)) {
                updateData.role = role;
            }

            if (ativo !== undefined) {
                updateData.ativo = Boolean(ativo);
            }

            // Atualização opcional de senha durante a edição
            if (senha && String(senha).trim().length >= 6) {
                const senhaHash = await bcrypt.hash(String(senha).trim(), 10);
                updateData.senha_hash = senhaHash;
                updateData.pin_hash = senhaHash;
            }

            const { data, error } = await supabase
                .from('usuarios')
                .update(updateData)
                .eq('id', id)
                .select('id, nome, email, role, ativo');

            if (error) throw error;

            auditoriaService.registrar({
                usuario: req.user,
                acao: 'EDICAO',
                tabela: 'usuarios',
                registroId: id,
                detalhes: { nome: updateData.nome, email: updateData.email, role: updateData.role, ativo: updateData.ativo }
            });

            return res.json({
                success: true,
                data: data ? data[0] : null,
                message: `Colaborador ${updateData.nome} atualizado com sucesso!`
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
                .select('id, nome, email, role, ativo');

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
                message: `Colaborador ${Boolean(ativo) ? 'ativado' : 'desativado'} com sucesso!`
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Altera a senha de acesso de um colaborador
     */
    async alterarSenha(req, res, next) {
        try {
            const { id } = req.params;
            const { senha, pin } = req.body;
            const novaSenha = senha || pin;

            if (!novaSenha || String(novaSenha).trim().length < 6) {
                return res.status(400).json({ success: false, error: 'A nova senha deve ter no mínimo 6 caracteres.' });
            }

            const senhaHash = await bcrypt.hash(String(novaSenha).trim(), 10);

            const { data, error } = await supabase
                .from('usuarios')
                .update({ senha_hash: senhaHash, pin_hash: senhaHash })
                .eq('id', id)
                .select('id, nome, email, role, ativo');

            if (error) throw error;

            if (!data || data.length === 0) {
                return res.status(404).json({ success: false, error: 'Colaborador não encontrado.' });
            }

            auditoriaService.registrar({
                usuario: req.user,
                acao: 'EDICAO',
                tabela: 'usuarios',
                registroId: id,
                detalhes: { campo: 'senha_alterada', colaborador: data[0].nome }
            });

            return res.json({
                success: true,
                message: `Senha de ${data[0].nome} alterada com sucesso!`
            });
        } catch (err) {
            next(err);
        }
    }

    // Mantém alias para compatibilidade
    async alterarPin(req, res, next) {
        return this.alterarSenha(req, res, next);
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

