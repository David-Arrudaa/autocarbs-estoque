const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const supabase = require('../../config/supabase');
const config = require('../../config/env');
const { gerarTokenSessao } = require('../../middlewares/auth');
const auditoriaService = require('../auditoria/auditoria.service');

function timingSafeMatch(a, b) {
    const bufA = Buffer.alloc(64);
    const bufB = Buffer.alloc(64);
    Buffer.from(String(a).trim()).copy(bufA);
    Buffer.from(String(b).trim()).copy(bufB);
    return crypto.timingSafeEqual(bufA, bufB);
}

class AuthController {
    /**
     * Efetua o login via PIN no servidor.
     * 1. Tenta autenticar na tabela 'usuarios' do Supabase com bcrypt hash.
     * 2. Se a tabela não existir ou o PIN não for de usuário cadastrado,
     *    testa contra os PINs mestres configurados no .env (Fallback Gracioso).
     */
    async login(req, res, next) {
        try {
            const { pin } = req.body;

            if (!pin || !String(pin).trim()) {
                return res.status(400).json({ success: false, error: 'O PIN de acesso é obrigatório.' });
            }

            const pinLimpo = String(pin).trim();
            let usuarioAutenticado = null;

            // 1. Tenta buscar usuário na tabela 'usuarios' do Supabase
            try {
                const { data: usuariosCadastrados, error: errDb } = await supabase
                    .from('usuarios')
                    .select('id, nome, pin_hash, role')
                    .eq('ativo', true);

                if (!errDb && Array.isArray(usuariosCadastrados) && usuariosCadastrados.length > 0) {
                    for (const u of usuariosCadastrados) {
                        const match = await bcrypt.compare(pinLimpo, u.pin_hash);
                        if (match) {
                            usuarioAutenticado = {
                                id: u.id,
                                nome: u.nome,
                                role: u.role
                            };
                            break;
                        }
                    }
                }
            } catch (errDb) {
                // Tabela ainda não existe ou erro de conexão — segue para o fallback
            }

            // 2. Fallback Gracioso: se não encontrou usuário no banco, testa contra PINs do .env
            if (!usuarioAutenticado) {
                if (timingSafeMatch(pinLimpo, config.pinSupervisor)) {
                    usuarioAutenticado = {
                        id: 'supervisor-master',
                        nome: 'Supervisor AutoCar',
                        role: 'supervisor'
                    };
                } else if (timingSafeMatch(pinLimpo, config.pinAcesso)) {
                    usuarioAutenticado = {
                        id: 'operador-master',
                        nome: 'Operador Oficina',
                        role: 'operador'
                    };
                }
            }

            // Se nenhum bateu, rejeita login
            if (!usuarioAutenticado) {
                return res.status(401).json({ success: false, error: 'Senha incorreta!' });
            }

            // Gera token com identidade e role para RBAC
            const token = gerarTokenSessao(usuarioAutenticado);

            // Registra login na trilha de auditoria (em background)
            auditoriaService.registrar({
                usuario: usuarioAutenticado,
                acao: 'LOGIN',
                tabela: 'usuarios',
                registroId: usuarioAutenticado.id,
                detalhes: { ip: req.ip || req.connection.remoteAddress }
            });

            return res.json({
                success: true,
                token,
                usuario: usuarioAutenticado
            });
        } catch (err) {
            next(err);
        }
    }

    /**
     * Verifica a validade do token de sessão ativo e retorna dados do perfil
     */
    verificarSessao(req, res) {
        return res.json({
            success: true,
            ativo: true,
            usuario: req.user
        });
    }
}

module.exports = new AuthController();
