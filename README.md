# AutoCar BS - ERP Oficina Mecânica

Sistema de gestão para oficinas mecânicas desenvolvido em **Node.js**, arquitetado de forma modular para evolução como ERP completo (Estoque, Ordens de Serviço, Clientes, Veículos e Financeiro).

---

## 🛠️ Arquitetura do Projeto

```
autocarbs-estoque/
├── .env                      # Variáveis de ambiente protegidas (PORT, SUPABASE_KEY, PINs)
├── .env.example              # Modelo de configuração
├── .gitignore                # Ignora node_modules e arquivos sensíveis
├── package.json              # Dependências e scripts npm
├── server.js                 # Ponto de entrada do servidor Express & APIs
│
├── src/                      # Backend (Node.js)
│   ├── config/
│   │   ├── env.js            # Validação e leitura das variáveis de ambiente
│   │   └── supabase.js       # Instância do cliente Supabase no servidor
│   ├── middlewares/
│   │   ├── auth.js           # Geração de tokens HMAC, verificação e rate limiting
│   │   └── errorHandler.js   # Tratamento unificado de erros
│   └── modules/              # Módulos do ERP (Oficina)
│       ├── auth/             # Módulo de Autenticação (Login com PIN)
│       │   ├── auth.controller.js
│       │   └── auth.routes.js
│       ├── estoque/          # Módulo de Estoque (Produtos, Reposição, Movimentações)
│       │   ├── estoque.controller.js
│       │   └── estoque.routes.js
│       ├── ordens-servico/   # [Futuro ERP: Ordens de Serviço da Oficina]
│       ├── clientes/         # [Futuro ERP: Cadastro de Clientes e Frotas]
│       └── veiculos/         # [Futuro ERP: Veículos e Histórico de Manutenção]
│
└── public/                   # Frontend Desacoplado (HTML, CSS e JS)
    ├── index.html            # Estrutura HTML limpa e semântica
    ├── css/
    │   └── style.css         # CSS isolado, com layout desktop e versão mobile em cards
    └── js/
        ├── api.js            # Cliente HTTP com autenticação Bearer e interceptor 401
        ├── ui.js             # Formatação de moeda, modais e proteção contra XSS (escapeHtml)
        ├── estoque.js        # Lógica de renderização de produtos, paginação e estatísticas
        └── app.js            # Inicializador e controle de sessão
```

---

## 🔒 Camadas de Segurança Implementadas

1. **Credenciais Protegidas no Servidor**:
   - As chaves de acesso ao banco Supabase e os PINs de operador (`2569`) e supervisor (`0177`) não ficam mais expostos no código frontend do navegador. Ficam salvos no arquivo `.env`.
2. **Proteção contra Força Bruta (Rate Limiting)**:
   - Limite de tentativas consecutivas de PIN no login (máx. 10 por 5 minutos).
   - Limite de tentativas para senha de exclusão de supervisor (máx. 5 por 5 minutos).
3. **Sessões Assinadas Criptograficamente**:
   - Tokens HMAC SHA-256 gerados no servidor com tempo de expiração.
4. **Proteção contra XSS (Cross-Site Scripting)**:
   - Todas as inserções no DOM passam por escape de caracteres perigosos (`<`, `>`, `&`, `"`, `'`).
5. **Exclusão Segura no Backend**:
   - Nenhuma exclusão pode ser disparada diretamente pelo cliente sem autorização e validação da senha de supervisor pelo servidor Node.js.

---

## 🚀 Como Executar o Sistema

1. **Instalar dependências**:
   ```bash
   npm install
   ```

2. **Iniciar o servidor**:
   ```bash
   npm start
   ```
   *Ou em modo de desenvolvimento com recarregamento automático:*
   ```bash
   npm run dev
   ```

3. **Acessar no Navegador**:
   Abra: [http://localhost:3000](http://localhost:3000)

---

## 🔑 Credenciais Padrão (configuráveis no `.env`):
- **PIN de Acesso**: `2569`
- **PIN do Supervisor (Exclusão)**: `0177`