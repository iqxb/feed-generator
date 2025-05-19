// api/feed/shopify/csv.js
const axios = require("axios");
const { stringify } = require("csv-stringify");

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
    const rows = products.map((p) => {
      const v = p.variants[0] || {};
      const img = p.images[0]?.src || "";
      const desc = (p.body_html || "")
        .replace(/<[^>]*>?/gm, "")
        .replace(/&/g, "&amp;");

      return {
        id: p.id,
        title: p.title,
        description: desc,
        link: `${shop}/products/${p.handle}`,
        image_link: img,
        price: v.price || "0.00",
        availability: v.available ? "in stock" : "out of stock",
        brand,
      };
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="shopify-feed.csv"`
    );
    stringify(
      rows,
      {
        header: true,
        columns: [
          "id",
          "title",
          "description",
          "link",
          "image_link",
          "price",
          "availability",
          "brand",
        ],
      },
      (err, output) => {
        if (err) {
          console.error(err);
          res.status(500).send("Error generating CSV");
        } else {
          res.send(output);
        }
      }
    );
  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating CSV feed");
  }
};
