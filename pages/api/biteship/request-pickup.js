export default async function handler(req, res) {
  const { deliveryId } = req.body;

  try {
    const response = await axios.post(
      `https://api.biteship.com/v1/orders/${deliveryId}/pickup`,
      {},
      {
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_BITESHIP_API_KEY}`,
        }
      }
    );

    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Failed to request pickup:', error.response?.data || error.message);
    return res.status(500).json({ message: 'Failed to request pickup' });
  }
}
