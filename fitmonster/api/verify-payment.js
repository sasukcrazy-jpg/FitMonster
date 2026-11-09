// Confirma com o Mercado Pago (servidor a servidor) se o pagamento foi aprovado.
// Nunca confie só nos parâmetros da URL: qualquer pessoa pode digitá-los.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const token = process.env.MP_ACCESS_TOKEN;
  const id = String((req.query && req.query.payment_id) || '');

  if (!token) return res.status(500).json({ approved: false });
  if (!/^\d{5,20}$/.test(id)) return res.status(400).json({ approved: false });

  try {
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const p = await r.json();
    const ref = String(p.external_reference || '');
    const ok = r.ok && p.status === 'approved' && ref.startsWith('fm-');
    return res.status(200).json({ approved: ok, plan: ok ? ref.split('-')[1] : null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ approved: false });
  }
};
