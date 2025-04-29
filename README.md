# Sistema de Escolha de Tutoria

Sistema web desenvolvido para gerenciar o processo de escolha de tutores pelos alunos de forma eficiente e organizada.

## 🚀 Funcionalidades

- Interface intuitiva para escolha de tutores
- Sistema de fila em tempo real com Socket.IO
- Painel administrativo para gestão
- Importação de dados de alunos e professores via CSV
- Cache inteligente para melhor performance
- Sistema de fila distribuído com Bull/Redis
- Monitoramento em tempo real das escolhas
- Interface responsiva e moderna
- Suporte a modo offline (PWA)

## 📋 Pré-requisitos

- Node.js (versão LTS recomendada)
- MongoDB
- Redis
- npm ou yarn

## 🔧 Instalação

1. Clone o repositório
```bash
git clone [url-do-repositorio]
cd escolha_tutoria
```

2. Instale as dependências
```bash
npm install
```

3. Configure as variáveis de ambiente
Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:
```
MONGODB_URI=
PORT=
REDIS_HOST=
REDIS_PORT=6379
NODE_ENV=
```

4. Importe os dados iniciais
```bash
node scripts/importar-alunos.js
node scripts/importar-professores.js
```

## 🚀 Executando o projeto

### Desenvolvimento
```bash
npm run dev
```

### Produção
```bash
npm start
```

## 📁 Estrutura do Projeto

- `/data` - Arquivos CSV com dados de alunos e professores
- `/public` - Arquivos estáticos e interface do usuário
- `/scripts` - Scripts utilitários para importação e gestão de dados
- `/src` - Código fonte do servidor
  - `/config` - Configurações do servidor e conexões
  - `/models` - Modelos de dados
  - `/routes` - Rotas da API

## 🛠️ Tecnologias Utilizadas

- Express.js - Framework web
- Socket.IO - Comunicação em tempo real
- MongoDB - Banco de dados
- Redis - Cache e filas
- Bull - Gerenciamento de filas
- Helmet - Segurança
- Compression - Otimização de performance
- Express Rate Limit - Controle de requisições

## 🔐 Segurança

O sistema implementa várias camadas de segurança:
- Rate limiting para prevenir sobrecarga
- Helmet para headers HTTP seguros
- Validação de dados
- Sanitização de entradas
- Cache inteligente
- Proteção contra CSRF

## 📊 Monitoramento

O sistema inclui monitoramento em tempo real de:
- Status da fila
- Estatísticas de escolhas
- Performance do sistema
- Logs detalhados

## 🤝 Contribuindo

1. Faça o fork do projeto
2. Crie sua feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença ISC.
