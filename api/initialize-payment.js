// This runs on the SERVER (Vercel), never in the user's browser.
// It's the only place your Paystack SECRET key should ever appear.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, phone, code, full_name, department, amount } = req.body;

  if (!email || !amount || !code) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Paystack expects the amount in kobo (i.e. Naira * 100)
    const amountInKobo = Math.round(amount * 100);

    // Build the URL Paystack should send the user back to after payment
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const callback_url = `${protocol}://${host}/callback.html`;

    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountInKobo,
        callback_url,
        metadata: {
          student_code: code,
          full_name,
          department,
          phone,
        },
      }),
    });

    const data = await paystackResponse.json();

    if (!data.status) {
      return res.status(400).json({ error: data.message || 'Paystack initialization failed' });
    }

    return res.status(200).json({
      authorization_url: data.data.authorization_url,
      reference: data.data.reference,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error while initializing payment' });
  }
}
