// api/track-order.js
// Récupère le statut d'une commande Printful
// Variables d'environnement :
//   PRINTFUL_API_KEY=xxx
//   STRIPE_SECRET_KEY=sk_live_xxx

const PRINTFUL_KEY = process.env.PRINTFUL_API_KEY;

const STATUS_MAP = {
  'draft':      { label: 'Brouillon',         step: 0 },
  'pending':    { label: 'En attente',         step: 1 },
  'inprocess':  { label: 'En production',      step: 2 },
  'onhold':     { label: 'En attente stock',   step: 2 },
  'partial':    { label: 'Partiellement expédié', step: 3 },
  'fulfilled':  { label: 'Expédié',            step: 3 },
  'archived':   { label: 'Archivé',            step: 4 },
  'canceled':   { label: 'Annulé',             step: -1 },
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { orderId } = req.query;
  if (!orderId) return res.status(400).json({ error: 'orderId requis' });

  try {
    // Chercher par external_id (= Stripe session ID) ou par ID Printful
    let orderData = null;

    // Essayer d'abord par external_id
    const searchRes = await fetch(`https://api.printful.com/orders?external_id=${orderId}`, {
      headers: { 'Authorization': `Bearer ${PRINTFUL_KEY}` }
    });
    const searchData = await searchRes.json();

    if (searchData.result && searchData.result.length > 0) {
      orderData = searchData.result[0];
    } else {
      // Essayer par ID direct
      const directRes = await fetch(`https://api.printful.com/orders/${orderId}`, {
        headers: { 'Authorization': `Bearer ${PRINTFUL_KEY}` }
      });
      const directData = await directRes.json();
      if (directData.result) orderData = directData.result;
    }

    if (!orderData) {
      return res.status(404).json({ error: 'Commande introuvable' });
    }

    const status = STATUS_MAP[orderData.status] || { label: orderData.status, step: 1 };

    // Récupérer le suivi depuis les shipments
    const shipments = orderData.shipments || [];
    const tracking = shipments.map(s => ({
      carrier: s.carrier,
      service: s.service,
      trackingNumber: s.tracking_number,
      trackingUrl: s.tracking_url,
      shippedAt: s.shipped_at,
      estimatedDelivery: s.estimated_delivery_dates?.max || null,
    }));

    return res.status(200).json({
      id: orderData.id,
      externalId: orderData.external_id,
      status: orderData.status,
      statusLabel: status.label,
      step: status.step,
      createdAt: orderData.created,
      items: orderData.items?.map(i => ({
        name: i.name,
        qty: i.quantity,
        image: i.files?.[0]?.preview_url || '',
      })) || [],
      shipping: {
        name: orderData.recipient?.name,
        address: orderData.recipient?.address1,
        city: orderData.recipient?.city,
        zip: orderData.recipient?.zip,
      },
      tracking,
      costs: orderData.retail_costs,
    });

  } catch (err) {
    console.error('Track order error:', err);
    return res.status(500).json({ error: err.message });
  }
};
