# Gerador de Arte Comercial — Higiclear / Hygibras

Ferramenta para o time de vendas montar artes de 4 produtos e enviar no WhatsApp.
O catálogo é sincronizado automaticamente do WooCommerce, sem mexer no site.

---

## Como funciona (visão geral)

1. **GitHub Action** roda toda madrugada → puxa produtos do WooCommerce via REST API
2. Baixa as imagens, otimiza (WebP, 500px) e gera `public/catalogo.json`
3. Publica tudo no **GitHub Pages** (já com CORS liberado)
4. O **gerador** (`public/index.html`) lê o catálogo e roda dentro de uma página do WordPress

Nada disso toca no `.htaccess` nem no servidor do site.

---

## Setup — passo a passo (uma vez só)

### 1. Criar o repositório
- Crie um repositório no GitHub (pode ser **privado**).
- Suba estes arquivos mantendo a estrutura:
  ```
  scripts/sync.js
  package.json
  .github/workflows/sync.yml
  public/index.html
  ```

### 2. Gerar a chave da API do WooCommerce
No WordPress:
- **WooCommerce → Configurações → Avançado → REST API → Adicionar chave**
- Descrição: `Sync Gerador Arte`
- Permissão: **Leitura** (somente leitura — importante para segurança)
- Copie o **Consumer Key** (`ck_...`) e **Consumer Secret** (`cs_...`)

### 3. Guardar as credenciais como Secrets (NÃO no código)
No repositório do GitHub → **Settings → Secrets and variables → Actions → New repository secret**.
Crie os três:

| Nome | Valor |
|------|-------|
| `WC_URL` | `https://www.higiclear.com` |
| `WC_KEY` | sua `ck_...` |
| `WC_SECRET` | sua `cs_...` |

> Os secrets ficam criptografados. Ninguém (nem você depois) consegue lê-los de volta — só usá-los.

### 4. Ativar o GitHub Pages
- **Settings → Pages → Build and deployment → Source: GitHub Actions**

### 5. Rodar o primeiro sync manualmente
- Aba **Actions → Sync Catálogo → Run workflow**
- Aguarde terminar (verde). Isso gera o catálogo e publica o site.
- Sua URL será algo como: `https://SEU-USUARIO.github.io/SEU-REPO/`

### 6. Ajustar o CATALOG_URL (se necessário)
- Abra `public/index.html`, linha do `CATALOG_URL`.
- Se o `index.html` e o `catalogo.json` estão na mesma pasta (padrão), pode deixar `'catalogo.json'`.

### 7. Embutir no WordPress
- Crie uma página no WP (ex: `/ferramentas/gerador-arte`), de preferência **restrita** (visível só para logados / time).
- No editor, adicione um bloco **HTML personalizado** e cole:
  ```html
  <iframe
    src="https://SEU-USUARIO.github.io/SEU-REPO/"
    style="width:100%;height:1100px;border:0;"
    title="Gerador de Arte">
  </iframe>
  ```
- Pronto. O time acessa pela página do WP; o conteúdo vem do GitHub.

---

## Manutenção

- **Catálogo atualiza sozinho** toda madrugada (cron no `sync.yml`).
- Para forçar agora: **Actions → Sync Catálogo → Run workflow**.
- Mudou o horário? Edite a linha `cron` em `.github/workflows/sync.yml` (está em UTC; 07:00 UTC = 04:00 BRT).

---

## Pontos de atenção / decisões pendentes

- **Sem telefone na arte:** o rodapé mostra apenas o site da marca (decisão do projeto).
- **Texto descritivo:** vem do `short_description` do Woo. Quando vazio, o campo aparece com placeholder "Clique para escrever a descrição..." e o vendedor preenche na hora. A geração é **bloqueada** se algum dos 4 textos estiver vazio.
- **Produtos sem foto:** aparecem com placeholder "sem imagem". O sync não quebra (mas o sync atual omite produtos sem imagem do catálogo).
- **Obrigatório 4 produtos:** o botão "Gerar" só habilita com exatamente 4 selecionados. Com menos, mostra o contador (ex: "Selecione 4 produtos (2/4)").

---

## Segurança

- A chave da API é **somente leitura** — mesmo que vaze, ninguém altera a loja.
- Para revogar: WooCommerce → REST API → revogar a chave e gerar outra.
- Os secrets nunca aparecem no código nem nos logs do Actions.
