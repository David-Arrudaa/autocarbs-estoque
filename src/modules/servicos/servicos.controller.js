/**
 * =========================================================
 * AUTOCAR BS - ERP OFICINA
 * Controller: Gestão de Serviços & Mão de Obra
 * =========================================================
 */

const servicosService = require('./servicos.service');

class ServicosController {
    async listar(req, res, next) {
        try {
            const { busca, categoria, pagina, limite, ordenarPor, ordem } = req.query;
            const resultado = await servicosService.listar({
                busca,
                categoria,
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
            const servico = await servicosService.obterPorId(id);
            if (!servico) {
                return res.status(404).json({
                    success: false,
                    mensagem: 'Serviço não encontrado.'
                });
            }
            return res.json({
                success: true,
                servico
            });
        } catch (err) {
            next(err);
        }
    }

    async cadastrar(req, res, next) {
        try {
            const servico = await servicosService.cadastrar(req.body, req.usuario);
            return res.status(201).json({
                success: true,
                mensagem: 'Serviço cadastrado com sucesso!',
                servico
            });
        } catch (err) {
            next(err);
        }
    }

    async atualizar(req, res, next) {
        try {
            const { id } = req.params;
            const servico = await servicosService.atualizar(id, req.body, req.usuario);
            return res.json({
                success: true,
                mensagem: 'Serviço atualizado com sucesso!',
                servico
            });
        } catch (err) {
            next(err);
        }
    }

    async excluir(req, res, next) {
        try {
            const { id } = req.params;
            await servicosService.excluir(id, req.usuario);
            return res.json({
                success: true,
                mensagem: 'Serviço excluído com sucesso!'
            });
        } catch (err) {
            next(err);
        }
    }

    async obterMetricas(req, res, next) {
        try {
            const metricas = await servicosService.obterMetricas();
            return res.json({
                success: true,
                metricas
            });
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new ServicosController();
