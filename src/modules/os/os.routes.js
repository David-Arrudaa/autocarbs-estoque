/**
 * =========================================================
 * AUTOCAR BS - ERP OFICINA
 * Rotas: Gestão de Ordens de Serviço (/api/os)
 * =========================================================
 */

const express = require('express');
const router = express.Router();
const osController = require('./os.controller');
const { autenticarRequisicao, apiLimiter } = require('../../middlewares/auth');

router.use(autenticarRequisicao);
router.use(apiLimiter);

router.get('/', (req, res, next) => osController.listar(req, res, next));
router.get('/:id', (req, res, next) => osController.obter(req, res, next));
router.post('/', (req, res, next) => osController.salvar(req, res, next));
router.put('/:id', (req, res, next) => {
    req.body.id = req.params.id;
    return osController.salvar(req, res, next);
});
router.delete('/:id', (req, res, next) => osController.excluir(req, res, next));

module.exports = router;
