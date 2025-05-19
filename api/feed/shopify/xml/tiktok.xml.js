// api/feed/shopify/xml/tiktok.js
const axios = require("axios");
const { XMLBuilder } = require("fast-xml-parser");

async function fetchAllProducts(shop, collection = "all") {
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

module.exports = async (req, res) => {
  const { shop, brand = "Unknown", collection = "all" } = req.query;
  if (!shop) {
    res.status(400).send("Missing ?shop=");
    return;
  }

  try {
    const products = await fetchAllProducts(shop, collection);
    const productList = products.map((p) => {
      const v = p.variants[0] || {};
      const img = p.images[0]?.src || "";
      const desc = (p.body_html || "")
        .replace(/<[^>]*>?/gm, "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

      return {
        id: p.id,
        title: p.title,
        description: desc,
        image_link: img,
        link: `${shop}/products/${p.handle}`,
        price: v.price || "0.00",
        availability: v.available ? "in stock" : "out of stock",
        brand,
      };
    });

    const feed = { products: { product: productList } };
    const xml = new XMLBuilder({ ignoreAttributes: false, format: true }).build(
      feed
    );

    res.setHeader("Content-Type", "application/xml");
    res.send(xml);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating XML feed");
  }
};
