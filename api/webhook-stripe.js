const PRINTFUL_KEY = process.env.PRINTFUL_API_KEY;

async function createPrintfulOrder(session) {
  const cart = JSON.parse(session.metadata?.cart || '[]');
  const shipping = session.shipping_details?.address;
  const name = session.shipping_details?.name || '';

  if (!shipping || cart.length === 0) return null;

  const items = [];
  for (const item of cart) {
    if (item.variationId) {
      items.push({ sync_variant_id: item.variationId, quantity: item.qty });
    } else if (item.productId) {
      try {
        const r = await fetch(`https://api.printful.com/sync/products/${item.productId}`, {
          headers: { 'Authorization': `Bearer ${PRINTFUL_KEY}` }
        });
        const d = await r.json();
        const variants = d.result?.sync_variants || [];
        if (variants.length > 0) items.push({ sync_variant_id: variants[0].id, quantity: item.qty });
      } catch(e) { console.error('variants error:', e); }
    }
  }

  if (items.length === 0) return null;

  const response = await fetch('https://api.printful.com/orders', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${PRINTFUL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      external_id: session.id,
      shipping: 'STANDARD',
      recipient: {
        name,
        email: session.customer_email || '',
        address1: shipping.line1,
        address2: shipping.line2 || '',
        city: shipping.city,
        zip: shipping.postal_code,
        country_code: shipping.country || 'FR',
      },
      items,
    }),
  });

  const data = await response.json();
  if (!response.ok) { console.error('Printful error:', data); return null; }

  await fetch(`https://api.printful.com/orders/${data.result.id}/confirm`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${PRINTFUL_KEY}` },
  });

  return data.result;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const rawBody = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => { data += chunk; });
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });

    const event = JSON.parse(rawBody);

    if (event.type === 'checkout.session.completed' && event.data.object.payment_status === 'paid') {
      await createPrintfulOrder(event.data.object);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(200).json({ received: true });
  }
};

module.exports.config = { api: { bodyParser: false } };