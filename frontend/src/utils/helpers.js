/**
 * Utility helper functions
 */

export const formatDate = (date) => {
  return new Date(date).toLocaleDateString();
};

export const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

export const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

const GOOGLE_MAPS_API_KEY = 'AIzaSyDVs_OL6_0yDALiTiuzuyO6cTb5A-JEyuo';

export function ensureMapsScript(callback) {
  if (window.google?.maps?.places) { callback(); return; }
  if (document.querySelector('#gmaps-script')) {
    window.__gmapsCallbacks = window.__gmapsCallbacks || [];
    window.__gmapsCallbacks.push(callback);
    return;
  }
  window.__gmapsCallbacks = [callback];
  window.__gmapsInit = () => window.__gmapsCallbacks.forEach(fn => fn());
  const s = document.createElement('script');
  s.id = 'gmaps-script';
  s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&callback=__gmapsInit`;
  s.async = true;
  document.head.appendChild(s);
}
