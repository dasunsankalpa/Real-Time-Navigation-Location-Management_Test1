/**
 * floodService.js
 * Real-time flood/heavy-rain detection for route waypoints.
 * Uses OpenWeatherMap Current Weather API (free tier).
 *
 * Weather condition codes that indicate flooding risk:
 *  502 – Heavy intensity rain
 *  503 – Very heavy rain
 *  504 – Extreme rain
 *  511 – Freezing rain
 *  522 – Heavy intensity shower rain
 *  531 – Ragged shower rain
 *  200-232 – Thunderstorm with rain
 *  Rain volume > 10 mm/h in last 1 h also flags as flood risk.
 */

const OWM_API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY || '';

const FLOOD_RAIN_IDS = new Set([502, 503, 504, 511, 522, 531]);
const FLOOD_RAIN_MM_THRESHOLD = 10; // mm in last 1 hour
const FOG_WEATHER_IDS = new Set([701, 741, 751, 761, 762, 771, 781]);

/**
 * Sample up to `maxSamples` evenly-spaced points from a Google Maps
 * overview_path array.
 */
function samplePath(path, maxSamples = 5) {
  if (!path || path.length === 0) return [];
  if (path.length <= maxSamples) return path;
  const step = Math.floor(path.length / maxSamples);
  return Array.from({ length: maxSamples }, (_, i) => path[i * step]);
}

/**
 * Fetch current weather for a single lat/lng.
 * Returns { isFlood, conditionId, rainMm, description } or null on error.
 */
async function fetchWeatherAt(lat, lng) {
  if (!OWM_API_KEY) return null;
  try {
    const url =
      `https://api.openweathermap.org/data/2.5/weather` +
      `?lat=${lat}&lon=${lng}&appid=${OWM_API_KEY}&units=metric`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    const conditionId = data.weather?.[0]?.id ?? 0;
    const description = data.weather?.[0]?.description ?? '';
    const rainMm = data.rain?.['1h'] ?? data.rain?.['3h'] ?? 0;

    // Condition-code-based flood detection
    const isFloodByCode = FLOOD_RAIN_IDS.has(conditionId)
      || (conditionId >= 200 && conditionId <= 232); // Thunderstorm with rain

    // Rain-volume-based flood detection
    const isFloodByRain = rainMm >= FLOOD_RAIN_MM_THRESHOLD;
    const isFog = FOG_WEATHER_IDS.has(conditionId);

    return {
      isFlood: isFloodByCode || isFloodByRain,
      isFog,
      conditionId,
      rainMm,
      description,
    };
  } catch {
    return null;
  }
}

/**
 * Check all sampled waypoints along a Google Maps route.
 * Returns { isFlood: boolean, floodPoint: LatLng|null }
 */
export async function checkRouteForFlood(overviewPath) {
  if (!OWM_API_KEY) {
    console.warn('[floodService] VITE_OPENWEATHER_API_KEY is not set.');
    return { isFlood: false, floodPoint: null };
  }

  const samples = samplePath(overviewPath, 5);

  for (const point of samples) {
    const lat = typeof point.lat === 'function' ? point.lat() : point.lat;
    const lng = typeof point.lng === 'function' ? point.lng() : point.lng;
    const result = await fetchWeatherAt(lat, lng);
    if (result?.isFlood) {
      return { isFlood: true, floodPoint: point };
    }
  }

  return { isFlood: false, floodPoint: null };
}

/**
 * Check all sampled waypoints along a Google Maps route for fog / low visibility.
 * Returns { isFog: boolean, fogPoint: LatLng|null }
 */
export async function checkRouteForFog(overviewPath) {
  if (!OWM_API_KEY) {
    console.warn('[floodService] VITE_OPENWEATHER_API_KEY is not set.');
    return { isFog: false, fogPoint: null };
  }

  const samples = samplePath(overviewPath, 5);

  for (const point of samples) {
    const lat = typeof point.lat === 'function' ? point.lat() : point.lat;
    const lng = typeof point.lng === 'function' ? point.lng() : point.lng;
    const result = await fetchWeatherAt(lat, lng);
    if (result?.isFog) {
      return { isFog: true, fogPoint: point };
    }
  }

  return { isFog: false, fogPoint: null };
}
