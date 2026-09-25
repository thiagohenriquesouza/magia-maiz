# Magia

Aplicação mobile-first para criação de cartas personalizadas com foto, integrada à OpenAI e à infraestrutura da Vercel.

## Desenvolvimento

```bash
npm install
copy .env.example .env.local
npm run dev
```

A experiência em português fica em `/` e a versão em espanhol em `/es`.

## Infraestrutura

- Next.js na Vercel;
- OpenAI Image API executada somente no servidor;
- Vercel Blob público com retenção aproximada de duas horas;
- Postgres para eventos operacionais sem dados pessoais;
- Vercel Cron para limpeza periódica dos arquivos.

Execute `scripts/schema.sql` no banco antes da publicação. Configure as variáveis descritas em `.env.example` no projeto da Vercel.

## Privacidade

Nome, foto e resposta são mantidos apenas durante a geração. Os eventos armazenados contêm somente data, idioma, tipo do evento e Unidade de Negócio quando aplicável.
