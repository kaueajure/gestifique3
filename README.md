<div align="center">

# 🎫 Gestifique

### Gestão de atendimento e suporte em uma plataforma completa

Centralize chamados, clientes, equipes, SLA, conhecimento e canais de atendimento em uma experiência moderna e preparada para crescer.

![React](https://img.shields.io/badge/React-19-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Backend-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-Database-4479A1?style=flat-square&logo=mysql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-Background%20Jobs-DC382D?style=flat-square&logo=redis&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-Real--time-010101?style=flat-square&logo=socketdotio&logoColor=white)

</div>

---

## ✨ Sobre o projeto

O **Gestifique** é uma plataforma SaaS de atendimento criada para organizar a operação de suporte de ponta a ponta.

A aplicação reúne gestão de chamados, empresas, usuários, relatórios, base de conhecimento, portal do cliente, satisfação e canais de comunicação em uma única interface.

O projeto foi estruturado para funcionar tanto em uma implantação simples quanto em ambientes com separação entre aplicação web e processamento em background.

## 🚀 Principais recursos

- 🎫 **Gestão de chamados** com acompanhamento completo do atendimento
- 🏢 **Empresas e clientes** centralizados na mesma operação
- 👥 **Usuários e permissões** para diferentes perfis de acesso
- ⏱️ **SLA e regras de atendimento** configuráveis
- 💬 **WhatsApp** integrado à operação
- 📚 **Base de conhecimento** para conteúdo interno e suporte
- 🌐 **Portal do cliente** para acompanhamento dos atendimentos
- ⭐ **CSAT / satisfação** após o atendimento
- 📊 **Dashboard e relatórios** para acompanhamento da operação
- 🧾 **Logs e auditoria** de ações importantes
- ⚡ **Atualizações em tempo real** com Socket.IO
- 🔄 **Processamento em background** com suporte a Redis e workers

## 🛠️ Stack

| Camada | Tecnologias |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Motion |
| Backend | Node.js, Express, TypeScript |
| Banco de dados | MySQL / MariaDB |
| Tempo real | Socket.IO |
| Background | Redis, Node Cron, Worker separado |
| Autenticação e segurança | JWT, bcrypt, Helmet, CORS, Rate Limit |
| E-mail | Nodemailer, IMAP, Mailparser |
| Uploads | Multer + camada de Storage |

## 🧱 Arquitetura

O Gestifique pode ser executado de duas formas:

### Modo monolítico

API, aplicação web e tarefas em background no mesmo processo.

```bash
npm start
```

### Web + Worker

A carga pode ser separada em processos independentes para melhorar escalabilidade e isolamento de tarefas.

```bash
npm start
npm run start:worker
```

## 💻 Executando localmente

### Pré-requisitos

- Node.js 18+
- MySQL ou MariaDB
- Redis para recursos que dependem de fila/background

### 1. Clone o projeto

```bash
git clone https://github.com/kaueajure/gestifique.git
cd gestifique
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure o ambiente

Crie seu `.env` a partir do arquivo de exemplo disponível no projeto.

```bash
cp .env.example .env
```

### 4. Execute as migrations

```bash
npm run db:migrate
```

### 5. Inicie em desenvolvimento

```bash
npm run dev
```

## 📦 Build

```bash
npm run build
npm start
```

## 🌐 Produção

Em ambientes atrás de proxy reverso, configure corretamente as variáveis relacionadas ao proxy, CORS e serviços de background.

Exemplo:

```env
TRUST_PROXY=1
ENABLE_WEB_SERVER=true
ENABLE_TICKET_JOBS=true
ENABLE_EMAIL_LISTENER=false
```

Para uma implantação com PM2:

```bash
pm2 start dist-server/server.js --name gestifique
```

Se utilizar worker separado:

```bash
pm2 start dist-server/worker.js --name gestifique-worker
```

O checklist completo de produção, rollback, workers e healthcheck está disponível em:

```text
docs/PRODUCTION_RUNBOOK.md
```

## 🔐 Segurança

O projeto utiliza diferentes camadas de proteção, incluindo:

- Helmet com políticas de segurança
- CORS configurável
- Rate limiting
- autenticação baseada em JWT
- hashing de senhas com bcrypt
- validação de origem atrás de proxy
- abstração de armazenamento para uploads

---

<div align="center">

Desenvolvido com foco em **produto, performance e escalabilidade** para operações modernas de atendimento.

</div>
