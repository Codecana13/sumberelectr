// pages/api/biteship/areas.js

export default async function handler(req, res) {
  const { q = '' } = req.query;

  const response = await fetch(`https://api.biteship.com/v1/maps/areas?countries=ID&input=${encodeURIComponent(q)}`, {
    headers: {
      'Authorization': `Bearer ${process.env.BITESHIP_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    return res.status(response.status).json({ error: 'Gagal ambil area dari Biteship' });
  }

  const data = await response.json();
  res.status(200).json(data.areas || []);
}
