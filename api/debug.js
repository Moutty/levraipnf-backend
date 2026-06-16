const PRINTFUL_KEY = process.env.PRINTFUL_API_KEY;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const endpoints = [
      'https://api.printful.com/stores',
      'https://api.printful.com/sync/products',
      'https://api.printful.com/products',
    ];
    const results = {};
    for (const url of endpoints) {
      const r = await fetch(url, {
        headers: { 'Authorization': `Bearer ${PRINTFUL_KEY}` }
      });
      const data = await r.json();
      results[url] = { status: r.status, data: data };
    }
    return res.status(200).json(results);
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};