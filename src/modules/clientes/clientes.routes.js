/**
 * =========================================================
 * AUTOCAR BS - ERP OFICINA
 * Rotas: Clientes & Veículos (/api/clientes)
 * =========================================================
 */

const express = require('express');
const router = express.Router();
const clientesController = require('./clientes.controller');
const { autenticarRequisicao, apiLimiter } = require('../../middlewares/auth');

router.use(autenticarRequisicao);
router.use(apiLimiter);

router.get('/', (req, res, next) => clientesController.listar(req, res, next));
router.get('/metricas', (req, res, next) => clientesController.metricas(req, res, next));
router.get('/:id', (req, res, next) => clientesController.obterPorId(req, res, next));
router.post('/', (req, res, next) => clientesController.salvar(req, res, next));
router.put('/:id', (req, res, next) => {
    req.body.id = req.params.id;
    return clientesController.salvar(req, res, next);
});
router.delete('/:id', (req, res, next) => clientesController.excluir(req, res, next));

module.exports = router;
