const PRINTFUL_KEY = process.env.PRINTFUL_API_KEY;
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const r = await fetch('https://api.printful.com/store/products?limit=5', {
      headers: { 'Authorization': `Bearer ${PRINTFUL_KEY}` }
    });
    const data = await r.json();
    return res.status(200).json(data);
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};