// api/feed/shopify/xml/google.js
const axios         = require('axios');
const { XMLBuilder } = require('fast-xml-parser');

/** Hent alle produkter (paginating) */
async function fetchAllProducts(shop, collection = 'all') {
  let all = [], page = 1, batch = [];
  do {
    const url = `${shop}/collections/${collection}/products.json`;
    const res = await axios.get(url, { params:{ limit:250, page } });
    batch = res.data.products;
    all.push(...batch);
    page++;
  } while (batch.length === 250);
  return all;
}

/**
 * GET /api/feed/shopify/xml/google.xml?shop=<url>&brand=<brand>&collection=<handle>
 */
module.exports = async (req, res) => {
  const { shop, brand = 'Unknown', collection = 'all' } = req.query;
  if (!shop) {
    return res.status(400).send('Missing ?shop=');
  }

  try {
    const products = await fetchAllProducts(shop, collection);

    // Map produkter til <item>-objekter
    const items = products.map(p => {
      const v            = p.variants[0] || {};
      const price        = v.price || '0.00';
      const availability = v.available ? 'in stock' : 'out of stock';
      const link         = `${shop}/products/${p.handle}`;
      const image_link   = p.images[0]?.src || '';
      const desc         = (p.body_html||'').replace(/<[^>]*>?/gm,'').trim();
      const shopifyType  = p.product_type || '';
      const googleCat    = p.product_type || '';

      return {
        'g:id'                       : p.id,
        'g:title'                    : p.title,
        'g:description'              : desc,
        'g:link'                     : link,
        'g:image_link'               : image_link,        // Viktig for WordPress-import
        'g:price'                    : `${price} ${v.currency||''}`.trim(),
        'g:availability'             : availability,
        'g:condition'                : 'new',
        'g:brand'                    : brand,
        'g:product_type'             : shopifyType,
        'g:google_product_category'  : googleCat
      };
    });

    const feedObj = {
      rss: {
        '@_xmlns:g': 'http://base.google.com/ns/1.0',
        '@_version': '2.0',
        channel: {
          title:       `Google CSS feed for ${brand}`,
          link:        shop,
          description: `A Google Shopping feed for ${brand}`,
          item:        items
        }
      }
    };

    const xmlBody = new XMLBuilder({ ignoreAttributes:false, format:true }).build(feedObj);
    const xml     = `<?xml version="1.0" encoding="UTF-8"?>\n` + xmlBody;

    res.setHeader('Content-Type','application/xml');
    res.send(xml);

  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating XML feed');
  }
};
