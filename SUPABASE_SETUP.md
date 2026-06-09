# Ativar o banco e login do NextFreela

Siga estes passos no navegador.

## 1. Criar projeto

1. Entre em https://supabase.com.
2. Clique em **New project**.
3. Escolha sua organizacao.
4. Nome sugerido: `NextFreela`.
5. Crie uma senha forte para o banco.
6. Escolha a regiao mais proxima.
7. Clique em **Create new project**.

## 2. Criar a tabela do app

1. No menu lateral do Supabase, clique em **SQL Editor**.
2. Clique em **New query**.
3. Abra o arquivo `supabase-schema.sql` deste projeto.
4. Copie tudo.
5. Cole no SQL Editor.
6. Clique em **Run**.

Isso cria a tabela `nextfreela_states` e protege os dados para cada usuario ver apenas a propria conta.

## 3. Ativar login por email

1. No Supabase, abra **Authentication**.
2. Entre em **Providers**.
3. Ative **Email**.
4. Salve.

## 4. Pegar as chaves

1. Abra **Project Settings**.
2. Entre em **API**.
3. Copie o campo **Project URL**.
4. Copie o campo **anon public**.

## 5. Colocar as chaves na Vercel

1. Abra https://vercel.com.
2. Entre no projeto `NextFreela`.
3. Clique em **Settings**.
4. Clique em **Environment Variables**.
5. Adicione:

```text
VITE_SUPABASE_URL
```

com o valor do **Project URL**.

6. Adicione:

```text
VITE_SUPABASE_ANON_KEY
```

com o valor da chave **anon public**.

7. Salve.

## 6. Publicar de novo

1. Na Vercel, entre em **Deployments**.
2. Clique nos tres pontos do deploy mais recente.
3. Clique em **Redeploy**.
4. Aguarde finalizar.

Quando abrir o app, ele deve mostrar **Aguardando login** ou **Sincronizado** em vez de **Demo local**.
