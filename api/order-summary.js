// api/order-summary.js
// Renvoie un resume immediat de la commande juste apres le paiement Stripe
// (nombre d'articles, montant, reference de commande), a partir du session_id
// retourne par Stripe sur la page de succes. Utilise pour la pop-up de
// remerciement -- volontairement independant de Printful/webhook, qui peut
// prendre quelques secondes a creer la commande cote production.
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ error: 'session_id requis' });

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (!session || session.payment_status !== 'paid') {
      return res.status(404).json({ error: 'Commande introuvable' });
    }

    const cart = JSON.parse(session.metadata?.cart || '[]');
    const itemCount = cart.reduce((sum, item) => sum + (parseInt(item.qty, 10) || 1), 0);

    return res.status(200).json({
      orderRef: session.metadata?.orderRef || session.id.substring(0, 32),
      itemCount,
      amountTotal: session.amount_total,
      currency: session.currency,
      email: session.customer_email || session.customer_details?.email || '',
    });
  } catch (err) {
    console.error('order-summary error:', err);
    return res.status(500).json({ error: err.message });
  }
};

