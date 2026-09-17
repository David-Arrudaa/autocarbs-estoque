const express = require('express');
const router = express.Router();
const usuariosController = require('./usuarios.controller');
const { autenticarRequisicao, exigirRole, apiLimiter } = require('../../middlewares/auth');

// Todas as rotas de gerenciamento de usuários requerem autenticação e perfil Supervisor ou Admin
router.use(autenticarRequisicao);
router.use(apiLimiter);
router.use(exigirRole('supervisor', 'admin'));

router.get('/', (req, res, next) => usuariosController.listar(req, res, next));
router.post('/', (req, res, next) => usuariosController.criar(req, res, next));
router.put('/:id/status', (req, res, next) => usuariosController.alternarStatus(req, res, next));

module.exports = router;

