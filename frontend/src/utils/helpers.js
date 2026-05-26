/**
 * Utility helper functions
 */

export const formatDate = (date) => {
  return new Date(date).toLocaleDateString();
};

export const formatViewedAgo = (timestamp) => {
  if (!timestamp) return 'Viewed';

  // The timestamp is stored as an absolute instant in the database.
  // We compare it against the current system time and present the age in
  // Sri Lanka-friendly relative units: minutes under 1 hour, hours under 24, days under 7, weeks otherwise.
  const viewedAt = new Date(timestamp).getTime();
  const now = Date.now();
  const diffMs = now - viewedAt;

  if (!Number.isFinite(viewedAt) || diffMs < 0) {
    return 'Viewed';
  }

  const minutes = Math.floor(diffMs / (1000 * 60));

  if (minutes < 60) {
    return `Viewed by ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `Viewed by ${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return `Viewed by ${days} day${days === 1 ? '' : 's'} ago`;
  }

  const weeks = Math.floor(days / 7);
  return `Viewed by ${weeks} week${weeks === 1 ? '' : 's'} ago`;
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
