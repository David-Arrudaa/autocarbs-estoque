/**
 * =========================================================
 * AUTOCAR BS - ERP OFICINA
 * Rotas: Gestão de Serviços & Mão de Obra (/api/servicos)
 * =========================================================
 */

const express = require('express');
const router = express.Router();
const servicosController = require('./servicos.controller');
const { autenticarRequisicao, apiLimiter } = require('../../middlewares/auth');

router.use(autenticarRequisicao);
router.use(apiLimiter);

router.get('/', (req, res, next) => servicosController.listar(req, res, next));
router.get('/metricas/resumo', (req, res, next) => servicosController.obterMetricas(req, res, next));
router.get('/:id', (req, res, next) => servicosController.obterPorId(req, res, next));
router.post('/', (req, res, next) => servicosController.cadastrar(req, res, next));
router.put('/:id', (req, res, next) => servicosController.atualizar(req, res, next));
router.delete('/:id', (req, res, next) => servicosController.excluir(req, res, next));

module.exports = router;
