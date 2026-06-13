// api/webhook-stripe.js
// Reçoit les webhooks Stripe et crée automatiquement la commande Printful
// Variables d'environnement nécessaires :
//   STRIPE_SECRET_KEY=sk_live_xxx
//   STRIPE_WEBHOOK_SECRET=whsec_xxx
//   PRINTFUL_API_KEY=xxx

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const PRINTFUL_KEY = process.env.PRINTFUL_API_KEY;

async function createPrintfulOrder(session) {
  const cart = JSON.parse(session.metadata?.cart || '[]');
  const shipping = session.shipping_details?.address;
  const name = session.shipping_details?.name || session.metadata?.customerName || '';

  if (!shipping || cart.length === 0) {
    console.error('Missing shipping or cart data');
    return null;
  }

  const nameParts = name.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const items = cart.map(item => ({
    sync_variant_id: item.variationId || undefined,
    external_variant_id: item.variationId ? undefined : String(item.productId),
    quantity: item.qty,
  })).filter(i => i.sync_variant_id || i.external_variant_id);

  if (items.length === 0) {
    console.error('No valid items for Printful');
    return null;
  }

  const orderPayload = {
    external_id: session.id,
    shipping: 'STANDARD',
    recipient: {
      name: name,
      first_name: firstName,
      last_name: lastName,
      email: session.customer_email || '',
      address1: shipping.line1,
      address2: shipping.line2 || '',
      city: shipping.city,
      zip: shipping.postal_code,
      country_code: shipping.country || 'FR',
    },
    items,
    retail_costs: {
      currency: 'EUR',
      subtotal: String((session.amount_total - 500) / 100),
      shipping: '5.00',
      total: String(session.amount_total / 100),
    }
  };

  const response = await fetch('https://api.printful.com/orders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PRINTFUL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(orderPayload),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Printful order error:', data);
    return null;
  }

  // Confirmer la commande (la mettre en production)
  const confirmRes = await fetch(`https://api.printful.com/orders/${data.result.id}/confirm`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${PRINTFUL_KEY}` },
  });

  const confirmData = await confirmRes.json();
  console.log('Printful order confirmed:', confirmData.result?.id);
  return confirmData.result;
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    // Vérifier la signature Stripe
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Paiement réussi → créer commande Printful
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    if (session.payment_status === 'paid') {
      console.log('Payment successful, creating Printful order...');
      const order = await createPrintfulOrder(session);
      if (order) {
        console.log('✓ Printful order created:', order.id);
      }
    }
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(200).json({ received: true });
};

// Helper pour lire le body brut (nécessaire pour Stripe webhook)
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// Config Vercel pour désactiver le body parser (nécessaire pour les webhooks Stripe)
module.exports.config = {
  api: { bodyParser: false }
};
