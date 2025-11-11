export function generateInvoiceId() {
  const pad = (n) => n.toString().padStart(2, '0');
  const d = new Date();
  const datePart = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const timePart = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INV-${datePart}${timePart}-${rand}`;
}