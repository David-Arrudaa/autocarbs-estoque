/**
 * =========================================================
 * AUTOCAR BS - ERP OFICINA
 * Controller: Gestão de Clientes & Veículos
 * =========================================================
 */

const clientesService = require('./clientes.service');

class ClientesController {
    async listar(req, res, next) {
        try {
            const { busca, pagina, limite, ordenarPor, ordem } = req.query;
            const resultado = await clientesService.listar({
                busca,
                pagina,
                limite,
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

    async obterPorId(req, res, next) {
        try {
            const { id } = req.params;
            const cliente = await clientesService.obterPorId(id);
            if (!cliente) {
                return res.status(404).json({
                    success: false,
                    mensagem: 'Cliente não encontrado.'
                });
            }
            return res.json({
                success: true,
                cliente
            });
        } catch (err) {
            next(err);
        }
    }

    async salvar(req, res, next) {
        try {
            const cliente = await clientesService.salvar(req.body, req.usuario);
            return res.json({
                success: true,
                mensagem: req.body.id ? 'Cliente atualizado com sucesso!' : 'Cliente cadastrado com sucesso!',
                cliente
            });
        } catch (err) {
            next(err);
        }
    }

    async excluir(req, res, next) {
        try {
            const { id } = req.params;
            await clientesService.excluir(id, req.usuario);
            return res.json({
                success: true,
                mensagem: 'Cliente e veículos vinculados excluídos com sucesso!'
            });
        } catch (err) {
            next(err);
        }
    }

    async metricas(req, res, next) {
        try {
            const metricas = await clientesService.obterMetricas();
            return res.json({
                success: true,
                metricas
            });
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new ClientesController();
