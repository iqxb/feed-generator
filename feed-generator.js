// feed-generator.js

const express = require('express');
const axios = require('axios');
const { XMLBuilder } = require('fast-xml-parser');
const { stringify } = require('csv-stringify');

const app = express();

/** 
 * Fetch *all* live products from a Shopify collection
 * (defaults to the “all” collection, paginated 250 at a time)
 */
async function fetchAllProducts(shop, collection = 'all') {
  let all = [];
  let page = 1;
  let batch = [];

  do {
    const url = `${shop}/collections/${collection}/products.json`;
    const res = await axios.get(url, { params: { limit: 250, page } });
    batch = res.data.products;
    all.push(...batch);
    page++;
  } while (batch.length === 250);

  return all;
}

/**
 * 1) TikTok-style XML feed
 * GET /feed/shopify/xml/tiktok?shop=<store>&brand=<brand>&collection=<handle>
 */
app.get('/feed/shopify/xml/tiktok', async (req, res) => {
  const { shop, brand = 'Unknown', collection = 'all' } = req.query;
  if (!shop) return res.status(400).send('Missing ?shop=');

  try {
    const products = await fetchAllProducts(shop, collection);

    const productList = products.map(p => {
      const v = p.variants[0] || {};
      const img = p.images[0]?.src || '';
      const desc = (p.body_html || '')
        .replace(/<[^>]*>?/gm, '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

      return {
        id: p.id,
        title: p.title,
        description: desc,
        image_link: img,
        link: `${shop}/products/${p.handle}`,
        price: v.price || '0.00',
        availability: v.available ? 'in stock' : 'out of stock',
        brand
      };
    });

    const feed = { products: { product: productList } };
    const xml = new XMLBuilder({ ignoreAttributes: false, format: true }).build(feed);

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating XML feed');
  }
});

/**
 * 2) CSV feed
 * GET /feed/shopify/csv?shop=<store>&brand=<brand>&collection=<handle>
 */
app.get('/feed/shopify/csv', async (req, res) => {
  const { shop, brand = 'Unknown', collection = 'all' } = req.query;
  if (!shop) return res.status(400).send('Missing ?shop=');

  try {
    const products = await fetchAllProducts(shop, collection);

    // Map into flat rows
    const rows = products.map(p => {
      const v = p.variants[0] || {};
      const img = p.images[0]?.src || '';
      const desc = (p.body_html || '')
        .replace(/<[^>]*>?/gm, '')
        .replace(/&/g, '&amp;');

      return {
        id: p.id,
        title: p.title,
        description: desc,
        link: `${shop}/products/${p.handle}`,
        image_link: img,
        price: v.price || '0.00',
        availability: v.available ? 'in stock' : 'out of stock',
        brand
      };
    });

    res.header('Content-Type', 'text/csv');
    res.attachment('shopify-feed.csv');

    // Stream CSV
    stringify(rows, {
      header: true,
      columns: [
        'id',
        'title',
        'description',
        'link',
        'image_link',
        'price',
        'availability',
        'brand'
      ]
    }).pipe(res);

  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating CSV feed');
  }
});

// Start listening
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}
• XML (TikTok): http://localhost:${PORT}/feed/shopify/xml/tiktok?shop=<store>&brand=<brand>&collection=<handle>
• CSV (Snapchat/Meta): http://localhost:${PORT}/feed/shopify/csv?shop=<store>&brand=<brand>&collection=<handle>`);
});
