# Gestifique

Sistema de gestão de atendimento e suporte. Reúne chamados, empresas, usuários, SLA, base de conhecimento, portal do cliente, relatórios e canais de atendimento em uma única aplicação.

## Funcionalidades

- gestão de chamados e histórico de atendimento
- empresas, clientes e usuários
- perfis de acesso e permissões
- regras de SLA
- portal do cliente
- base de conhecimento
- pesquisa de satisfação (CSAT)
- relatórios e dashboard
- logs de auditoria
- integração com WhatsApp
- atualizações em tempo real com Socket.IO
- tarefas em background com suporte a Redis e worker separado

## Stack

- React 19, TypeScript, Vite e Tailwind CSS
- Node.js e Express
- MySQL / MariaDB
- Socket.IO
- Redis
- JWT e bcrypt
- Nodemailer, IMAP e Mailparser

## Rodando localmente

Requisitos:

- Node.js 18+
- MySQL ou MariaDB
- Redis, caso os recursos de background sejam utilizados

```bash
git clone https://github.com/kaueajure/gestifique.git
cd gestifique
npm install
cp .env.example .env
npm run db:migrate
npm run dev
```

As credenciais do banco, autenticação, e-mail e demais integrações devem ser configuradas no `.env`.

## Build

```bash
npm run build
npm start
```

## Processamento em background

Por padrão, a aplicação pode executar API e tarefas no mesmo processo. Também existe um worker separado para isolar jobs em background:

```bash
npm run start:worker
```

Em produção, essa separação permite manter o processo web independente das tarefas agendadas e outros trabalhos assíncronos.

## Produção

Quando a aplicação estiver atrás de proxy reverso, revise principalmente estas configurações:

```env
TRUST_PROXY=1
ENABLE_WEB_SERVER=true
ENABLE_TICKET_JOBS=true
ENABLE_EMAIL_LISTENER=false
```

Há um guia mais detalhado de produção, rollback, workers e healthcheck em `docs/PRODUCTION_RUNBOOK.md`.
