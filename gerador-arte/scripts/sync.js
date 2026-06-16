#!/usr/bin/env node
/**
 * sync.js — Sincroniza catálogo do WooCommerce para o gerador de arte.
 *
 * O que faz:
 *  1. Lê TODOS os produtos publicados via REST API do WooCommerce (paginado).
 *  2. Para cada produto: baixa a imagem principal, redimensiona e converte para
 *     WebP (leve, ideal para carregar rápido no gerador / WhatsApp).
 *  3. Limpa o short_description (remove HTML, corta em ~120 caracteres).
 *  4. Gera public/catalogo.json — consumido pelo index.html.
 *
 * Credenciais via variáveis de ambiente (NUNCA hardcode):
 *   WC_URL      = https://www.higiclear.com
 *   WC_KEY      = ck_xxxxxxxxxxxx
 *   WC_SECRET   = cs_xxxxxxxxxxxx
 *
 * Uso local:  WC_URL=... WC_KEY=... WC_SECRET=... node scripts/sync.js
 * No GitHub:  as 3 variáveis vêm de Secrets (ver workflow).
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const WC_URL = (process.env.WC_URL || '').replace(/\/$/, '');
const WC_KEY = process.env.WC_KEY;
const WC_SECRET = process.env.WC_SECRET;

if (!WC_URL || !WC_KEY || !WC_SECRET) {
  console.error('❌ Faltam variáveis: WC_URL, WC_KEY, WC_SECRET');
  process.exit(1);
}

const OUT_DIR = path.join(__dirname, '..', 'public');
const IMG_DIR = path.join(OUT_DIR, 'img');
fs.mkdirSync(IMG_DIR, { recursive: true });

const auth = 'Basic ' + Buffer.from(`${WC_KEY}:${WC_SECRET}`).toString('base64');

// limpa HTML e corta o texto descritivo
function cleanDesc(html, max = 120) {
  if (!html) return '';
  let t = html
    .replace(/<[^>]+>/g, ' ')      // remove tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length <= max) return t;
  // corta no fim da última palavra antes do limite
  t = t.slice(0, max);
  const lastSpace = t.lastIndexOf(' ');
  return (lastSpace > 40 ? t.slice(0, lastSpace) : t).trim() + '…';
}

// busca produtos paginando até acabar
async function fetchAllProducts() {
  const all = [];
  let page = 1;
  while (true) {
    const url = `${WC_URL}/wp-json/wc/v3/products?status=publish&per_page=100&page=${page}`;
    const res = await fetch(url, { headers: { Authorization: auth } });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`API erro ${res.status} na página ${page}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    all.push(...data);
    console.log(`  página ${page}: +${data.length} produtos (total ${all.length})`);
    if (data.length < 100) break;
    page++;
  }
  return all;
}

// baixa e otimiza uma imagem; devolve nome do arquivo local ou null
async function processImage(src, slug) {
  if (!src) return null;
  try {
    const res = await fetch(src);
    if (!res.ok) { console.warn(`  ⚠ imagem ${res.status}: ${slug}`); return null; }
    const buf = Buffer.from(await res.arrayBuffer());
    const fileName = `${slug}.webp`;
    await sharp(buf)
      .resize(500, 500, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(path.join(IMG_DIR, fileName));
    return `img/${fileName}`;
  } catch (e) {
    console.warn(`  ⚠ falha imagem ${slug}: ${e.message}`);
    return null;
  }
}

(async () => {
  console.log('🔄 Buscando produtos do WooCommerce...');
  const products = await fetchAllProducts();
  console.log(`✅ ${products.length} produtos encontrados. Processando imagens...`);

  const catalog = [];
  for (const p of products) {
    const slug = (p.slug || `produto-${p.id}`).slice(0, 60);
    const imgSrc = p.images && p.images[0] ? p.images[0].src : null;
    const localImg = await processImage(imgSrc, slug);

    // categoria principal (primeira)
    const cat = p.categories && p.categories[0] ? p.categories[0].name : 'Sem categoria';

    catalog.push({
      id: p.id,
      name: p.name,
      cat,
      desc: cleanDesc(p.short_description || p.description),
      img: localImg,           // caminho local otimizado (com CORS via GitHub Pages)
      link: p.permalink || ''
    });
  }

  // remove produtos sem imagem (não servem para arte visual) — pode ajustar
  const withImg = catalog.filter(c => c.img);
  const skipped = catalog.length - withImg.length;
  if (skipped) console.log(`  ℹ ${skipped} produtos sem imagem foram omitidos.`);

  const out = {
    updated_at: new Date().toISOString(),
    count: withImg.length,
    products: withImg
  };

  fs.writeFileSync(path.join(OUT_DIR, 'catalogo.json'), JSON.stringify(out, null, 2));
  console.log(`\n✅ catalogo.json gerado com ${withImg.length} produtos.`);
})().catch(e => {
  console.error('❌ Erro fatal:', e.message);
  process.exit(1);
});
