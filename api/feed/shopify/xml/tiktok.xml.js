// api/feed/shopify/xml/tiktok.js
const axios = require('axios');
const { XMLBuilder } = require('fast-xml-parser');

/**
 * Fetch all live products from a Shopify collection
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
 * TikTok-style XML feed
 * GET /api/feed/shopify/xml/tiktok.xml?shop=<store>&brand=<brand>&collection=<handle>
 */
module.exports = async (req, res) => {
  const { shop, brand = 'Unknown', collection = 'all' } = req.query;
  if (!shop) {
    res.status(400).send('Missing ?shop=');
    return;
  }

  try {
    const products = await fetchAllProducts(shop, collection);

    // Map products into RSS <item> entries with Google namespace tags
    const items = products.map(p => {
      const v = p.variants[0] || {};
      const price = v.price || '0.00';
      const availability = v.available ? 'in stock' : 'out of stock';
      const link = `${shop}/products/${p.handle}`;
      const image_link = p.images[0]?.src || '';

      return {
        'g:id': p.id,
        'g:title': p.title,
        'g:description': (p.body_html || '').replace(/<[^>]*>?/gm, ''),
        'g:availability': availability,
        'g:condition': 'new',
        'g:price': `${price} ${v.currency || ''}`.trim(),
        'g:link': link,
        'g:image_link': image_link,
        'g:brand': brand
      };
    });

    // Build RSS envelope
    const feedObj = {
      rss: {
        '@_xmlns:g': 'http://base.google.com/ns/1.0',
        '@_version': '2.0',
        channel: {
          item: items
        }
      }
    };

    const xml = new XMLBuilder({ ignoreAttributes: false, format: true }).build(feedObj);

    res.setHeader('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating XML feed');
  }
};
