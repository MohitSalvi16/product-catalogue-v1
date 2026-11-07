const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatPrice(price: number) {
  return currency.format(price);
}
