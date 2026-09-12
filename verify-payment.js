// This runs on the SERVER (Vercel). It re-checks with Paystack directly
// instead of trusting anything the browser claims — this is what stops
// someone from faking a "successful payment" by editing the URL.

import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client uses the SERVICE ROLE key, which bypasses
// Row Level Security. Keep this key ONLY in Vercel environment variables,
// never in frontend code.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { reference } = req.query;

  if (!reference) {
    return res.status(400).json({ success: false, error: 'Missing reference' });
  }

  try {
    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const data = await paystackResponse.json();

    if (!data.status || data.data.status !== 'success') {
      return res.status(200).json({ success: false, error: 'Payment was not successful' });
    }

    const tx = data.data;

    // Log the transaction in Supabase (insert if it doesn't already exist)
    const { error: dbError } = await supabase.from('transactions').upsert({
      reference: tx.reference,
      student_code: tx.metadata?.student_code || null,
      full_name: tx.metadata?.full_name || null,
      department: tx.metadata?.department || null,
      email: tx.customer?.email || null,
      phone: tx.metadata?.phone || null,
      amount: tx.amount / 100,
      status: tx.status,
    }, { onConflict: 'reference' });

    if (dbError) {
      console.error('Supabase insert error:', dbError);
      // Payment itself succeeded even if logging failed — still tell the user it worked
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: 'Server error while verifying payment' });
  }
}
