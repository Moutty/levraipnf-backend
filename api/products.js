// api/products.js
// Récupère les produits depuis Printful (sync products)
// Variables d'environnement :
// PRINTFUL_API_KEY=xxx

const PRINTFUL_KEY = process.env.PRINTFUL_API_KEY;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Récupérer tous les produits synchronisés
    const res1 = await fetch('https://api.printful.com/store/products?limit=50', {
      headers: { 'Authorization': `Bearer ${PRINTFUL_KEY}` }
    });
    const data = await res1.json();

    if (!data.result) {
      return res.status(500).json({ error: 'Erreur Printful', details: data });
    }

    // Pour chaque produit, récupérer les variantes
    const products = await Promise.all(
      data.result.map(async (p) => {
        try {
          const varRes = await fetch(`https://api.printful.com/store/products/${p.id}`, {
            headers: { 'Authorization': `Bearer ${PRINTFUL_KEY}` }
          });
          const varData = await varRes.json();
          const product = varData.result?.sync_product;
          const variants = varData.result?.sync_variants || [];
          const fallbackImage = product?.thumbnail_url || '';

          return {
            id: p.id,
            name: product?.name || p.name,
            image: fallbackImage,
            variants: variants.map(v => ({
              id: v.id,
              name: v.name,
              size: v.size || extractSize(v.name),
              color: v.color || '',
              price: v.retail_price,
              inStock: v.availability_status === 'active',
              image: extractVariantImage(v, fallbackImage),
            }))
          };
        } catch(e) {
          return { id: p.id, name: p.name, image: '', variants: [] };
        }
      })
    );

    return res.status(200).json({ products });

  } catch (err) {
    console.error('Products error:', err);
    return res.status(500).json({ error: err.message });
  }
};

function extractSize(variantName) {
  const sizes = ['XS','S','M','L','XL','XXL','3XL','ONE SIZE'];
  for (const s of sizes) {
    if (variantName.toUpperCase().includes(s)) return s;
  }
  return 'ONE SIZE';
}

// Récupère le visuel (mockup) propre à une variante/couleur donnée.
// Printful expose les visuels dans `files` (type "preview" en priorité),
// avec parfois un visuel générique sur `product.image`. On tente plusieurs
// clés car le nom exact du champ peut varier selon le type de produit.
function extractVariantImage(v, fallback) {
  const files = Array.isArray(v.files) ? v.files : [];
  const preview =
    files.find(f => f.type === 'preview') ||
    files.find(f => f.preview_url || f.thumbnail_url || f.url) ||
    files[0];
  const fromFile = preview && (preview.preview_url || preview.thumbnail_url || preview.url);
  return fromFile || v.product?.image || fallback || '';
}
