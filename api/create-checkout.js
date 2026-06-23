const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { cart, customer } = req.body;
    if (!cart || cart.length === 0) return res.status(400).json({ error: 'Panier vide' });

    const lineItems = cart.map(item => ({
      price_data: {
        currency: 'eur',
        product_data: {
          name: item.name,
          description: item.size && item.size !== 'ONE SIZE' ? `Taille: ${item.size}` : undefined,
        },
        unit_amount: Math.round(item.priceNum * 100),
      },
      quantity: item.qty,
    }));

    lineItems.push({
      price_data: {
        currency: 'eur',
        product_data: { name: 'Livraison France' },
        unit_amount: 500,
      },
      quantity: 1,
    });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://levraipnf.store';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${siteUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}?payment=cancelled`,
      customer_email: customer?.email || undefined,
      shipping_address_collection: {
        allowed_countries: ['FR', 'BE', 'CH', 'LU'],
      },
      metadata: {
        cart: JSON.stringify(cart.map(i => ({
          name: i.name,
          productId: String(i.productId || i.id || ''),
          variationId: i.variationId ? String(i.variationId) : '',
          qty: i.qty,
          size: i.size || 'ONE SIZE'
        }))),
        customerName: customer?.name || ''
      },
      locale: 'fr',
    });

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Stripe error:', err);
    return res.status(500).json({ error: err.message });
  }
};