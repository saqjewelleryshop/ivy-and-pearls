const FROM = process.env.EMAIL_FROM || 'Ivy & Pearls <clientcare@ivyandpearls.co.uk>';

export async function sendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn(`[email skipped] ${subject} -> ${to}`);
    return { skipped: true };
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from: FROM, to: Array.isArray(to) ? to : [to], subject, html })
  });
  if (!r.ok) throw new Error(`Email provider failed (${r.status}).`);
  return r.json();
}

export function orderConfirmationHtml(order) {
  const items = order.items.map(i => `<li>${escapeHtml(i.product_name)} × ${i.quantity}</li>`).join('');
  return `<div style="font-family:Arial,sans-serif;color:#17271f;max-width:620px;margin:auto">
    <h1 style="font-family:Georgia,serif;font-weight:400">Thank you for your order.</h1>
    <p>We’ve received order <strong>${escapeHtml(order.order_number)}</strong> and will keep you updated as it moves through fulfilment.</p>
    <ul>${items}</ul>
    <p>Complimentary UK delivery · Estimated 7–14 working days.</p>
    <p>Ivy &amp; Pearls<br>clientcare@ivyandpearls.co.uk</p>
  </div>`;
}

export function dispatchHtml(order) {
  return `<div style="font-family:Arial,sans-serif;color:#17271f;max-width:620px;margin:auto">
    <h1 style="font-family:Georgia,serif;font-weight:400">Your Ivy &amp; Pearls order is on its way.</h1>
    <p>Order <strong>${escapeHtml(order.order_number)}</strong> has been dispatched.</p>
    <p>Tracking: <strong>${escapeHtml(order.tracking_number || '')}</strong></p>
    <p>You can follow the latest status from your account.</p>
  </div>`;
}

function escapeHtml(value='') {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}
