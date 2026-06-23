const PRINTFUL_KEY = process.env.PRINTFUL_API_KEY;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let event;
    if (req.body && typeof req.body === 'object') {
      event = req.body;
    } else if (req.body && typeof req.body === 'string') {
      event = JSON.parse(req.body);
    } else {
      const rawBody = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => resolve(data));
        req.on('error', reject);
      });
      event = JSON.parse(rawBody);
    }

    console.log('Event type:', event.type);
    console.log('Payment status:', event.data?.object?.payment_status);

    if (event.type === 'checkout.session.completed' && event.data?.object?.payment_status === 'paid') {
      const session = event.data.object;
      const cart = JSON.parse(session.metadata?.cart || '[]');
      const shipping = session.shipping_details?.address;
      const name = session.shipping_details?.name || '';

      console.log('Cart:', JSON.stringify(cart));
      console.log('Shipping:', JSON.stringify(shipping));

      if (!shipping || cart.length === 0) {
        console.error('Missing shipping or cart');
        return res.status(200).json({ received: true });
      }

      const items = [];
      for (const item of cart) {
        if (item.variationId) {
          items.push({ sync_variant_id: item.variationId, quantity: item.qty });
        } else if (item.productId) {
          const r = await fetch(`https://api.printful.com/sync/products/${item.productId}`, {
            headers: { 'Authorization': `Bearer ${PRINTFUL_KEY}` }
          });
          const d = await r.json();
          const variants = d.result?.sync_variants || [];
          if (variants.length > 0) {
            items.push({ sync_variant_id: variants[0].id, quantity: item.qty });
          }
        }
      }

      console.log('Items:', JSON.stringify(items));

      if (items.length === 0) {
        console.error('No items');
        return res.status(200).json({ received: true });
      }

      const orderRes = await fetch('https://api.printful.com/orders', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${PRINTFUL_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          external_id: session.id,
          shipping: 'STANDARD',
          recipient: { name, email: session.customer_email || '', address1: shipping.line1, city: shipping.city, zip: shipping.postal_code, country_code: shipping.country || 'FR' },
          items,
        }),
      });

      const orderData = await orderRes.json();
      console.log('Printful response:', JSON.stringify(orderData));

      if (orderData.result?.id) {
        await fetch(`https://api.printful.com/orders/${orderData.result.id}/confirm`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${PRINTFUL_KEY}` },
        });
        console.log('Order confirmed:', orderData.result.id);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(200).json({ received: true });
  }
};