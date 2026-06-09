# NextFreela

Plataforma para freelancers criativos gerenciarem projetos, agenda, financeiro, clientes e alertas.

O app funciona em dois modos:

- **Demo local**: sem Supabase, salva os dados no navegador.
- **Conta sincronizada**: com Supabase, salva os dados na nuvem por usuario.

## Rodar localmente

1. Instale as dependencias:

```bash
npm install
```

2. Inicie o app:

```bash
npm run dev
```

3. Abra o endereco exibido no terminal.

Sem Supabase configurado, o app roda em modo demonstracao e salva dados no navegador.

## Ativar Supabase

1. Acesse https://supabase.com e crie um projeto.
2. Abra o projeto e entre em **SQL Editor**.
3. Crie uma nova query.
4. Cole todo o conteudo de `supabase-schema.sql`.
5. Clique em **Run**.
6. Entre em **Authentication > Providers**.
7. Ative **Email**.
8. Opcional: ative **Google** para login social.
9. Entre em **Project Settings > API**.
10. Copie:

- Project URL
- anon public key

11. Copie `.env.example` para `.env.local`.
12. Preencha:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

13. Rode novamente:

```bash
npm run build
```

## Publicar na Vercel

1. Envie este projeto para um repositorio GitHub.
2. Importe o repositorio na Vercel.
3. Configure as variaveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. Publique.

Na Vercel:

1. Abra o projeto `NextFreela`.
2. Entre em **Settings > Environment Variables**.
3. Adicione `VITE_SUPABASE_URL`.
4. Adicione `VITE_SUPABASE_ANON_KEY`.
5. Entre em **Deployments**.
6. Clique nos tres pontos do ultimo deploy.
7. Clique em **Redeploy**.

Tambem da para usar:

```bash
npm run build
npm run deploy
```

## Estrutura atual

- `index.html`: interface principal.
- `styles.css`: design system visual.
- `app.js`: interacoes, estado local e sincronizacao opcional com tabelas Supabase.
- `supabase-schema.sql`: tabelas de projetos, tarefas, pagamentos, conversas, mensagens e alertas com politicas de seguranca.
- `vercel.json`: configuracao de deploy.

## Checklist de plataforma real

- [x] Publicacao na Vercel.
- [x] Login por email preparado.
- [x] Login por Google preparado.
- [x] Banco Supabase preparado.
- [x] Dados por usuario com Row Level Security.
- [x] Tabelas reais para projetos, tarefas, pagamentos, mensagens e alertas.
- [ ] Criar projeto no Supabase.
- [ ] Colar e executar `supabase-schema.sql`.
- [ ] Configurar variaveis na Vercel.
- [ ] Fazer redeploy.
