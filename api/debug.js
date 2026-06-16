const PRINTFUL_KEY = process.env.PRINTFUL_API_KEY;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const r = await fetch('https://api.printful.com/sync/products?limit=50', {
      headers: { 'Authorization': `Bearer ${PRINTFUL_KEY}` }
    });
    const data = await r.json();

    if (!Array.isArray(data.result)) {
      return res.status(500).json({ error: 'Format inattendu', raw: data });
    }

    const products = await Promise.all(
      data.result.map(async (p) => {
        try {
          const vr = await fetch(`https://api.printful.com/sync/products/${p.id}`, {
            headers: { 'Authorization': `Bearer ${PRINTFUL_KEY}` }
          });
          const vd = await vr.json();
          const product = vd.result?.sync_product || p;
          const variants = vd.result?.sync_variants || [];
          return {
            id: p.id,
            name: product.name || p.name,
            image: product.thumbnail_url || p.thumbnail_url || '',
            variants: variants.map(v => ({
              id: v.id,
              name: v.name,
              size: v.size || extractSize(v.name),
              color: v.color || '',
              price: v.retail_price,
              inStock: v.availability_status !== 'discontinued',
            }))
          };
        } catch(e) {
          return { id: p.id, name: p.name, image: p.thumbnail_url || '', variants: [] };
        }
      })
    );

    return res.status(200).json({ products });
  }