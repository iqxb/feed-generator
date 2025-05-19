// api/feed/shopify/xml/tiktok.xml.js
const axios       = require('axios');
const { XMLBuilder } = require('fast-xml-parser');

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

module.exports = async (req, res) => {
  const { shop, brand = 'Unknown', collection = 'all' } = req.query;
  if (!shop) return res.status(400).send('Missing ?shop=');

  try {
    const products = await fetchAllProducts(shop, collection);

    const items = products.map(p => {
      const v = p.variants[0] || {};
      return {
        'g:id':           p.id,
        'g:title':        p.title,
        'g:description':  (p.body_html||'').replace(/<[^>]*>?/gm, ''),
        'g:availability': v.available ? 'in stock' : 'out of stock',
        'g:condition':    'new',
        'g:price':        `${v.price||'0.00'} ${v.currency||''}`.trim(),
        'g:link':         `${shop}/products/${p.handle}`,
        'g:image_link':   p.images[0]?.src||'',
        'g:brand':        brand
      };
    });

    const feedObj = {
      rss: {
        '@_xmlns:g': 'http://base.google.com/ns/1.0',
        '@_version': '2.0',
        channel: {
          title:       `TikTok feed for ${brand}`,
          link:        shop,
          description: `A TikTok-style product feed for ${brand}`,
          item:        items
        }
      }
    };

    // Build and send
    const xml = new XMLBuilder({ ignoreAttributes:false, format:true, declaration: { include:true, encoding:'UTF-8', version:'1.0' } })
                  .build(feedObj);
    res.setHeader('Content-Type','application/xml; charset=utf-8');
    res.send(xml);

  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating XML feed');
  }
};
