// Cria o pagamento no Mercado Pago (Checkout Pro: Pix, cartão e boleto).
// Os preços ficam AQUI no servidor: o navegador só escolhe o plano.
const PLANS = {
  mensal: { title: 'FitMonster Pro - Mensal', price: 19.9 },
  anual: { title: 'FitMonster Pro - Anual', price: 149.9 },
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const token = process.env.MP_ACCESS_TOKEN;
  const site = (process.env.SITE_URL || '').replace(/\/$/, '');
  if (!token || !site) return res.status(500).json({ error: 'Servidor não configurado' });

  const key = req.body && req.body.plan;
  if (typeof key !== 'string' || !Object.prototype.hasOwnProperty.call(PLANS, key)) {
    return res.status(400).json({ error: 'Plano inválido' });
  }
  const plan = PLANS[key];

  try {
    const r = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ id: key, title: plan.title, quantity: 1, currency_id: 'BRL', unit_price: plan.price }],
        external_reference: `fm-${key}-${Date.now()}`,
        back_urls: { success: `${site}/`, pending: `${site}/`, failure: `${site}/` },
        auto_return: 'approved',
      }),
    });
    const data = await r.json();
    if (!r.ok || !data.init_point) {
      console.error('Mercado Pago:', r.status, JSON.stringify(data));
      return res.status(502).json({ error: 'Falha ao criar o pagamento' });
    }
    return res.status(200).json({ url: data.init_point });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno' });
  }
};
