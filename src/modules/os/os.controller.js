/**
 * =========================================================
 * AUTOCAR BS - ERP OFICINA
 * Controller: Gestão de Ordens de Serviço (OS)
 * =========================================================
 */

const osService = require('./os.service');

class OSController {
    async listar(req, res, next) {
        try {
            const { pagina, limite, busca, status, dataInicial, dataFinal, ordenarPor, ordem } = req.query;
            const resultado = await osService.listar({
                pagina,
                limite,
                busca,
                status,
                dataInicial,
                dataFinal,
                ordenarPor,
                ordem
            });

            return res.json({
                success: true,
                ...resultado
            });
        } catch (err) {
            next(err);
        }
    }

    async obter(req, res, next) {
        try {
            const { id } = req.params;
            const os = await osService.obterPorId(id);

            if (!os) {
                return res.status(404).json({
                    success: false,
                    mensagem: 'Ordem de serviço não encontrada.'
                });
            }

            return res.json({
                success: true,
                os
            });
        } catch (err) {
            next(err);
        }
    }

    async salvar(req, res, next) {
        try {
            const dados = req.body;
            const usuarioInfo = req.usuario || req.user || null;

            if (!dados.cliente_nome) {
                return res.status(400).json({
                    success: false,
                    mensagem: 'O nome do cliente é obrigatório para gerar ou editar a OS.'
                });
            }

            const os = await osService.salvar(dados, usuarioInfo);

            return res.json({
                success: true,
                mensagem: dados.id ? 'Ordem de serviço atualizada com sucesso!' : 'Ordem de serviço criada com sucesso!',
                os
            });
        } catch (err) {
            next(err);
        }
    }

    async excluir(req, res, next) {
        try {
            const { id } = req.params;
            const usuarioId = req.usuario?.id || null;

            await osService.excluir(id, usuarioId);

            return res.json({
                success: true,
                mensagem: 'Ordem de serviço excluída com sucesso!'
            });
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new OSController();
