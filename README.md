# NextFreela

Plataforma para freelancers criativos gerenciarem projetos, agenda, financeiro, clientes e alertas.

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

1. Crie um projeto no Supabase.
2. No SQL Editor, execute o arquivo `supabase-schema.sql`.
3. Copie `.env.example` para `.env.local`.
4. Preencha:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

5. Em Authentication, ative Email/Password e, se quiser, Google OAuth.

## Publicar na Vercel

1. Envie este projeto para um repositorio GitHub.
2. Importe o repositorio na Vercel.
3. Configure as variaveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. Publique.

Tambem da para usar:

```bash
npm run build
npm run deploy
```

## Estrutura atual

- `index.html`: interface principal.
- `styles.css`: design system visual.
- `app.js`: interacoes, estado local e sincronizacao opcional com Supabase.
- `supabase-schema.sql`: tabela e politicas de seguranca.
- `vercel.json`: configuracao de deploy.
