// api/create-checkout.js
// Crée une session Stripe Checkout
// Variables d'environnement nécessaires :
//   STRIPE_SECRET_KEY=sk_live_xxx
//   NEXT_PUBLIC_SITE_URL=https://levraipnf.store

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const { cart, customer } = req.body;

    if (!cart || cart.length === 0) {
      return res.status(400).json({ error: 'Panier vide' });
    }

    // Créer les line items Stripe depuis le panier
    const lineItems = cart.map(item => ({
      price_data: {
        currency: 'eur',
        product_data: {
          name: item.name,
          description: item.size ? `Taille: ${item.size}` : undefined,
          metadata: {
            productId: String(item.productId || ''),
            variationId: String(item.variationId || ''),
            size: item.size || 'ONE SIZE'
          }
        },
        unit_amount: Math.round(item.priceNum * 100), // en centimes
      },
      quantity: item.qty,
    }));

    // Frais de livraison (5€)
    lineItems.push({
      price_data: {
        currency: 'eur',
        product_data: { name: 'Livraison France' },
        unit_amount: 500,
      },
      quantity: 1,
    });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://levraipnf.store';

    // Créer la session Stripe
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
          productId: i.productId,
          variationId: i.variationId,
          qty: i.qty,
          size: i.size
        }))),
        customerName: customer?.name || ''
      },
      locale: 'fr',
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ url: session.url, sessionId: session.id });

  } catch (err) {
    console.error('Stripe error:', err);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: err.message });
  }
};
