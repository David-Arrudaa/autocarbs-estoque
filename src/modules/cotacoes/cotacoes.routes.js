const express = require('express');
const router = express.Router();
const cotacoesController = require('./cotacoes.controller');
const { autenticarRequisicao, apiLimiter } = require('../../middlewares/auth');

// Todas as rotas de cotações requerem autenticação
router.use(autenticarRequisicao);
router.use(apiLimiter);

router.get('/', (req, res, next) => cotacoesController.listar(req, res, next));
router.get('/:id', (req, res, next) => cotacoesController.obterPorId(req, res, next));
router.post('/', (req, res, next) => cotacoesController.salvar(req, res, next));
router.delete('/:id', (req, res, next) => cotacoesController.excluir(req, res, next));

module.exports = router;

