import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Megaphone, Wind, Phone } from 'lucide-react';
import bottomLogo from '../assets/bottomLogo.png';
import Logo from '../assets/Logo.png';
import Lotus from '../assets/Lotus.png';
import middle from '../assets/middle.png';
import { usePageTitle } from '../contexts/PageTitleContext';
import { checkRouteForFlood, checkRouteForFog } from '../utils/floodService';
import { ensureMapsScript } from '../utils/helpers';

export default function SafetyAlertTemplate() {
  const { setTitle, setActivePage, safetyData } = usePageTitle();

  useEffect(() => {
    setTitle('Safety Alert');
  }, [setTitle]);

  const routePath = safetyData?.routePath || [];
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [emergencyContacts] = useState([
    { name: 'Police', number: '119' },
    { name: 'Ambulance', number: '1990' },
    { name: 'Tourist police', number: '1912' }
  ]);

  const routeSummary = useMemo(() => {
    if (!safetyData) return '';
    return `${safetyData.origin ? 'From your current location' : 'Route'} to ${safetyData.destination || 'destination'}`;
  }, [safetyData]);

  useEffect(() => {
    let cancelled = false;

    const samplePoints = (path, maxSamples = 5) => {
      if (!path.length) return [];
      if (path.length <= maxSamples) return path;
      const step = Math.max(1, Math.floor(path.length / maxSamples));
      return Array.from({ length: maxSamples }, (_, index) => path[index * step]).filter(Boolean);
    };

    const fetchAirQuality = async (lat, lng) => {
      const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY || '';
      if (!apiKey) return null;
      try {
        const response = await fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lng}&appid=${apiKey}`);
        if (!response.ok) return null;
        const data = await response.json();
        const item = data.list?.[0];
        if (!item) return null;
        return {
          aqi: item.main?.aqi ?? 0,
          pm2_5: item.components?.pm2_5 ?? 0,
        };
      } catch {
        return null;
      }
    };

    const fetchClosedTouristAreas = async (path) => {
      return new Promise((resolve) => {
        if (!window.google?.maps?.places || !path.length) {
          resolve([]);
          return;
        }

        const service = new window.google.maps.places.PlacesService(document.createElement('div'));
        const points = samplePoints(path, 4);
        const collected = [];
        let remaining = points.length;

        if (remaining === 0) {
          resolve([]);
          return;
        }

        points.forEach((point) => {
          const location = new window.google.maps.LatLng(point.lat, point.lng);
          service.nearbySearch(
            { location, radius: 2000, type: 'tourist_attraction' },
            (results, status) => {
              if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
                results.slice(0, 5).forEach((place) => {
                  if (!place.place_id) return;
                  service.getDetails({ placeId: place.place_id, fields: ['name', 'business_status', 'geometry'] }, (detail, detailStatus) => {
                    if (detailStatus === window.google.maps.places.PlacesServiceStatus.OK && detail?.business_status && detail.business_status !== 'OPERATIONAL') {
                      collected.push({
                        name: detail.name,
                        status: detail.business_status,
                      });
                    }
                  });
                });
              }

              remaining -= 1;
              if (remaining === 0) {
                setTimeout(() => resolve(collected.slice(0, 3)), 250);
              }
            }
          );
        });
      });
    };

    const runChecks = async () => {
      setLoading(true);
      const nextAlerts = [];

      if (routePath.length > 0) {
        const flood = await checkRouteForFlood(routePath);
        if (flood.isFlood) {
          nextAlerts.push({
            id: 'weather',
            type: 'weather',
            icon: <AlertTriangle className="w-6 h-6" />, 
            title: 'Storm / flood risk on route',
            description: 'Weather along the current route indicates heavy rain or flood risk. Delay the trip if possible.',
          });
        }

        const fog = await checkRouteForFog(routePath);
        if (fog.isFog) {
          nextAlerts.push({
            id: 'fog',
            type: 'weather',
            icon: <AlertTriangle className="w-6 h-6" />,
            title: 'Heavy fog / low visibility on route',
            description: 'Visibility along the current route is reduced by fog or mist. Drive slowly and avoid starting if conditions worsen.',
          });
        }

        const midPoint = routePath[Math.floor(routePath.length / 2)] || routePath[0];
        if (midPoint) {
          const air = await fetchAirQuality(midPoint.lat, midPoint.lng);
          if (air && air.aqi >= 4) {
            nextAlerts.push({
              id: 'air',
              type: 'air',
              icon: <Wind className="w-6 h-6" />,
              title: 'Poor air quality near the route',
              description: `Air quality is poor (${air.aqi}/5) near the route. Limit outdoor exposure if you travel now.`,
            });
          }
        }

        const closedAreas = await fetchClosedTouristAreas(routePath);
        if (!cancelled && closedAreas.length > 0) {
          nextAlerts.push({
            id: 'closure',
            type: 'beach',
            icon: <Megaphone className="w-6 h-6" />,
            title: 'Tourist areas closed nearby',
            description: `${closedAreas.map((place) => `${place.name} (${place.status.replace(/_/g, ' ').toLowerCase()})`).join(', ')}.`,
          });
        }
      }

      if (nextAlerts.length === 0) {
        nextAlerts.push({
          id: 'clear',
          type: 'weather',
          icon: <AlertTriangle className="w-6 h-6" />,
          title: 'No major route alerts detected',
          description: 'No flood, closure, or air-quality issues were detected for the current route sample points.',
        });
      }

      if (!cancelled) {
        setAlerts(nextAlerts);
        setLoading(false);
      }
    };

    ensureMapsScript(() => {
      runChecks();
    });

    return () => {
      cancelled = true;
    };
  }, [routePath]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-blue-200 relative overflow-hidden font-sans" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="absolute top-0 left-0 right-0 h-32 overflow-hidden">
        <img src={bottomLogo} alt="Decorative pattern" className="w-full h-full object-cover opacity-60 scale-x-150" />
      </div>

      <main className="relative z-10 max-w-4xl mx-auto px-4 py-12">
        <div className="absolute inset-0 z-0 opacity-40">
          <img src={middle} alt="Ocean background" className="w-full h-full object-cover scale-x-[1.7]" />
        </div>

        <div className="relative z-10 space-y-4 mb-12">
          {routeSummary && <div className="mb-4 text-sm font-medium text-slate-700">{routeSummary}</div>}
          {loading && (
            <div className="rounded-xl bg-white/80 p-4 text-sm text-slate-600 shadow-lg">Checking route conditions...</div>
          )}
          {!loading && alerts.map((alert) => (
            <div key={alert.id} className="bg-gradient-to-r from-yellow-100 to-yellow-200 rounded-xl p-6 shadow-lg flex items-start gap-4 transition-transform hover:scale-[1.02]">
              <div className="bg-yellow-400 rounded-full p-3 text-gray-800">{alert.icon}</div>
              <div className="flex-1">
                <h3 className="font-bold text-lg text-gray-800 mb-1">{alert.title}</h3>
                <p className="text-gray-700 text-sm">{alert.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8 relative z-10">
          <h2 className="text-center text-red-600 font-bold text-xl mb-6">Emergency contact</h2>
          <div className="space-y-4">
            {emergencyContacts.map((contact, index) => (
              <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="bg-gray-200 rounded-full p-3">
                  <Phone className="w-6 h-6 text-gray-700" />
                </div>
                <div className="flex-1">
                  <span className="font-semibold text-gray-800">{contact.name}: </span>
                  <span className="text-gray-700 font-bold">{contact.number}</span>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setActivePage('start')}
            className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors shadow-md"
          >
            Back
          </button>
        </div>
      </main>

    </div>
  );
}
