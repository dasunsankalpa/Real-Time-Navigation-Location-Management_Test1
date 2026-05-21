import { useEffect, useRef, useState, useCallback } from 'react';
import middle from '../assets/middle.png';
import bikeIcon from '../assets/bikeIcon.png';
import manIcon from '../assets/manIcon.png';
import busIcon from '../assets/busIcon.png';
import coins from '../assets/coins.png';
import shareIcon from '../assets/shareIcon.png';
import carIcon from '../assets/carIcon.png';
import clockIcon from '../assets/clockIcon.png';
import blueLocationIcon from '../assets/directionCircle.png';
import redPinIcon from '../assets/locationRed.png';
import gpsIcon from '../assets/gpsSearch.png';
import threeDots from '../assets/3dots.png';
import upDown from '../assets/upDown.png';
import closeIcon from '../assets/closeIcon.png';
import { usePageTitle } from '../contexts/PageTitleContext';
import { ensureMapsScript } from '../utils/helpers';
import { checkRouteForFlood } from '../utils/floodService';
import LocationInput from '../components/LocationInput';

const MODE_CONFIGS = [
  { key: 'drive', label: 'Drive', icon: carIcon, travelMode: 'DRIVING', multiplier: 1 },
  { key: 'bike', label: 'Bike', icon: bikeIcon, travelMode: 'BICYCLING', multiplier: 1.35 },
  { key: 'transit', label: 'Transit', icon: busIcon, travelMode: 'TRANSIT', multiplier: 1.85 },
  { key: 'walk', label: 'Walk', icon: manIcon, travelMode: 'WALKING', multiplier: 8.5 },
];

const parseDurationToMinutes = (durationText = '') => {
  const normalized = durationText.toLowerCase();
  const dayMatch = normalized.match(/(\d+)\s*day/);
  const hourMatch = normalized.match(/(\d+)\s*hour/);
  const minuteMatch = normalized.match(/(\d+)\s*min/);

  const days = dayMatch ? Number(dayMatch[1]) : 0;
  const hours = hourMatch ? Number(hourMatch[1]) : 0;
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;

  return (days * 24 * 60) + (hours * 60) + minutes;
};

const formatCompactDuration = (minutes) => {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return '--';
  }

  if (minutes >= 24 * 60) {
    const days = Math.max(1, Math.round(minutes / (24 * 60)));
    return `${days} day${days > 1 ? 's' : ''}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);

  if (hours === 0) {
    return `${remainingMinutes} min`;
  }

  if (remainingMinutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${remainingMinutes} min`;
};

const estimateModeDuration = (baseMinutes, multiplier) => {
  if (!baseMinutes) return '--';
  return formatCompactDuration(Math.max(1, Math.round(baseMinutes * multiplier)));
};

const buildRouteDescription = (route, idx, allRoutes) => {
  if (!route || allRoutes.length === 0) return { summary: '', petrol: '' };

  const others = allRoutes.filter((_, i) => i !== idx);
  const mins = route.durationMinutes;

  // Distance comparison
  const parseKm = (d = '') => parseFloat(d.replace(/[^0-9.]/g, '')) || 0;
  const distKm = parseKm(route.distance);
  const otherDists = others.map(r => parseKm(r.distance)).filter(d => d > 0);
  const avgOtherDist = otherDists.length ? otherDists.reduce((a, b) => a + b, 0) / otherDists.length : distKm;
  const distDiff = distKm - avgOtherDist;
  const distNote =
    Math.abs(distDiff) < 0.5 ? 'similar in distance'
    : distDiff > 0 ? `${Math.abs(distDiff).toFixed(1)} km longer in distance`
    : `${Math.abs(distDiff).toFixed(1)} km shorter in distance`;

  // Time comparison
  const fasterCount = others.filter(r => r.durationMinutes > mins).length;
  const slowerCount = others.filter(r => r.durationMinutes < mins).length;

  let summary;
  if (allRoutes.length === 1) {
    summary = `This is the only available route and is ${distNote}.`;
  } else if (slowerCount === 0 && fasterCount > 0) {
    summary = `This route is faster than ${fasterCount} alternative${fasterCount > 1 ? 's' : ''} and ${distNote}.`;
  } else if (fasterCount === 0 && slowerCount > 0) {
    summary = `This route is slower than ${slowerCount} alternative${slowerCount > 1 ? 's' : ''} and ${distNote}.`;
  } else if (fasterCount > 0 && slowerCount > 0) {
    summary = `This route is faster than ${fasterCount} alternative${fasterCount > 1 ? 's' : ''}, slower than ${slowerCount}, and ${distNote}.`;
  } else {
    summary = `This route has similar travel time and is ${distNote}.`;
  }

  // Petrol saving vs slowest
  const maxMins = Math.max(...allRoutes.map(r => r.durationMinutes).filter(m => m > 0));
  const saving = maxMins > 0 && mins < maxMins ? Math.round(((maxMins - mins) / maxMins) * 100) : 0;
  const petrol = saving > 0 ? saving : 0;

  return { summary, petrol };
};

const describeRoute = (route, idx, allRoutes) => {
  if (!route || allRoutes.length === 0) return 'Suggested route';

  const mins = route.durationMinutes;
  const allMins = allRoutes.map(r => r.durationMinutes).filter(m => m > 0);
  const minTime = Math.min(...allMins);
  const maxTime = Math.max(...allMins);

  let routeLabel;
  if (allRoutes.length === 1) {
    routeLabel = 'Fastest route';
  } else if (mins === minTime) {
    routeLabel = 'Fastest route';
  } else if (mins === maxTime) {
    routeLabel = 'Slowest route';
  } else {
    const timeDiff = mins - minTime;
    routeLabel = `${formatCompactDuration(timeDiff)} slower`;
  }

  const via = route.summary ? `via ${route.summary}` : '';
  // Use real traffic from API if available, else fall back to ratio-based
  const traffic = route.traffic || (() => {
    const ratio = allRoutes.length > 1 ? mins / minTime : 1;
    return ratio >= 1.4 ? 'Heavy traffic' : ratio >= 1.15 ? 'Moderate traffic' : 'Light traffic';
  })();

  return [routeLabel, traffic, via].filter(Boolean).join(' · ');
};

const Direction = ({ showDetailsPanel = true }) => {
  const { searchedPlace, userLocation, setActivePage, pendingOriginLabel, pendingVehicle, setPendingOriginLabel, setPendingVehicle, setTitle, setEtaData, setSearchedPlace, setSafetyData, setHasSearched } = usePageTitle();

  useEffect(() => {
    setTitle('');
  }, [setTitle]);

  // Expose navigation and ETA setter globally for overlay click handler
  window.setActivePageGlobal = setActivePage;
  window.setEtaTitleGlobal = setTitle;
  window.setEtaDataGlobal = setEtaData;
  const destination = searchedPlace?.displayName || searchedPlace?.formatted_address?.split(',')[0] || 'destination';

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const renderersRef = useRef([]);
  const clickPathsRef = useRef([]);
  const routeRequestIdRef = useRef(0);
  const originMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  const trafficLayerRef = useRef(null);

  const [routes, setRoutes] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [selectedMode, setSelectedMode] = useState(() => {
    const map = { bus: 'transit', bike: 'bike', car: 'drive', man: 'walk' };
    return (pendingVehicle && map[pendingVehicle]) || 'drive';
  });
  const [error, setError] = useState(null);
  const [swapped, setSwapped] = useState(false);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [originLabel, setOriginLabel] = useState('');
  const [destPlace, setDestPlace] = useState(searchedPlace);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [addStopOpen, setAddStopOpen] = useState(false);
  const [stopQuery, setStopQuery] = useState('');
  const [stopSuggestions, setStopSuggestions] = useState([]);
  const [stopActiveIdx, setStopActiveIdx] = useState(-1);
  const [activeCategory, setActiveCategory] = useState(null);
  const [poiResults, setPoiResults] = useState([]);
  const [poiLoading, setPoiLoading] = useState(false);
  const [stopPanelCollapsed, setStopPanelCollapsed] = useState(false);

  const CATEGORY_TYPES = {
    'Restaurant':      { type: 'restaurant',    keyword: 'restaurant' },
    'Petrol Station':  { type: 'gas_station',   keyword: 'petrol station' },
    'Coffee Shop':     { type: 'cafe',          keyword: 'coffee shop' },
    'Supermarket':     { type: 'supermarket',   keyword: 'supermarket' },
  };

  const POI_ATTRACTION_KEYWORDS = [
    { type: 'tourist_attraction', keyword: 'historical site',      radius: 5000 },
    { type: 'place_of_worship',   keyword: 'temple church mosque', radius: 5000 },
    { type: 'museum',             keyword: 'museum cultural',      radius: 5000 },
    { type: 'restaurant',         keyword: 'highly rated restaurant', radius: 500 },
    { type: 'amusement_park',     keyword: 'fun park',             radius: 5000 },
  ];

  const getDistanceToPath = (point, path) => {
    const R = 6371000;
    const toRad2 = (v) => (v * Math.PI) / 180;
    let minDist = Infinity;
    const pLat = typeof point.lat === 'function' ? point.lat() : point.lat;
    const pLng = typeof point.lng === 'function' ? point.lng() : point.lng;
    for (const seg of path) {
      const sLat = typeof seg.lat === 'function' ? seg.lat() : seg.lat;
      const sLng = typeof seg.lng === 'function' ? seg.lng() : seg.lng;
      const dLat = toRad2(pLat - sLat);
      const dLng = toRad2(pLng - sLng);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad2(sLat)) * Math.cos(toRad2(pLat)) * Math.sin(dLng / 2) ** 2;
      const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      if (d < minDist) minDist = d;
    }
    return minDist;
  };

  const searchPlacesAlongRoute = useCallback((category) => {
    const result = directionsResultRef.current;
    if (!result || !mapInstanceRef.current) return;

    const routeIndex = selectedIdx;
    const path = result.routes[routeIndex]?.overview_path || [];
    if (!path.length) return;

    const config = CATEGORY_TYPES[category];
    if (!config) return;

    const searchRadius = config.type === 'gas_station' ? 1500 : 800;

    setPoiLoading(true);
    setPoiResults([]);
    clearPoiMarkers();

    const totalPoints = path.length;
    const sampleCount = Math.min(20, Math.max(8, Math.floor(totalPoints / 10)));
    const step = Math.max(1, Math.floor(totalPoints / sampleCount));
    const samplePoints = [];
    for (let i = 0; i < totalPoints; i += step) samplePoints.push(path[i]);
    if (samplePoints[samplePoints.length - 1] !== path[totalPoints - 1]) {
      samplePoints.push(path[totalPoints - 1]);
    }

    const service = new window.google.maps.places.PlacesService(mapInstanceRef.current);
    const seen = new Set();
    const collected = [];
    let pending = samplePoints.length;

    samplePoints.forEach((point) => {
      service.nearbySearch(
        { location: point, radius: searchRadius, type: config.type, keyword: config.keyword },
        (results, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
            results.forEach((place) => {
              if (seen.has(place.place_id)) return;
              const dist = getDistanceToPath(place.geometry.location, path);
              if (dist <= searchRadius) {
                seen.add(place.place_id);
                collected.push({
                  name: place.name,
                  rating: place.rating || null,
                  vicinity: place.vicinity || '',
                  photo: place.photos?.[0]?.getUrl({ maxWidth: 400, maxHeight: 400 }) || null,
                  placeId: place.place_id,
                  location: place.geometry.location,
                });
              }
            });
          }
          pending -= 1;
          if (pending === 0) {
            const sorted = collected.sort((a, b) => (b.rating || 0) - (a.rating || 0));
            setPoiResults(sorted);
            setPoiLoading(false);
            sorted.forEach((place) => {
              const marker = new window.google.maps.Marker({
                position: place.location,
                map: mapInstanceRef.current,
                title: place.name,
                icon: { url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png' },
              });
              const infoWindow = new window.google.maps.InfoWindow({
                content: `<div style="font-family:Inter,sans-serif;font-size:13px;max-width:160px"><strong>${place.name}</strong>${place.rating ? `<br/>⭐ ${place.rating.toFixed(1)}` : ''}<br/><span style="color:#6B7280;font-size:11px">${place.vicinity}</span></div>`,
              });
              marker.addListener('click', () => infoWindow.open(mapInstanceRef.current, marker));
              poiMarkersRef.current.push(marker);
            });
          }
        }
      );
    });
  }, [selectedIdx]);

  const searchAttractionsAlongRoute = useCallback(() => {
    const result = directionsResultRef.current;
    if (!result || !mapInstanceRef.current) return;

    const path = result.routes[selectedIdx]?.overview_path || [];
    if (!path.length) return;

    const totalPoints = path.length;
    const sampleCount = Math.min(15, Math.max(6, Math.floor(totalPoints / 12)));
    const step = Math.max(1, Math.floor(totalPoints / sampleCount));
    const samplePoints = [];
    for (let i = 0; i < totalPoints; i += step) samplePoints.push(path[i]);
    if (samplePoints[samplePoints.length - 1] !== path[totalPoints - 1]) {
      samplePoints.push(path[totalPoints - 1]);
    }

    setPoiLoading(true);
    setPoiResults([]);
    clearPoiMarkers();

    const service = new window.google.maps.places.PlacesService(mapInstanceRef.current);
    const seen = new Set();
    const collected = [];
    let pending = samplePoints.length * POI_ATTRACTION_KEYWORDS.length;

    samplePoints.forEach((point) => {
      POI_ATTRACTION_KEYWORDS.forEach(({ type, keyword, radius }) => {
        service.nearbySearch(
          { location: point, radius, type, keyword },
          (results, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
              results.forEach((place) => {
                if (seen.has(place.place_id)) return;
                const minRating = type === 'restaurant' ? 5.0 : 4.5;
                if ((place.rating || 0) < minRating) return;
                const dist = getDistanceToPath(place.geometry.location, path);
                if (dist <= radius) {
                  seen.add(place.place_id);
                  collected.push({
                    name: place.name,
                    rating: place.rating || null,
                    vicinity: place.vicinity || '',
                    photo: place.photos?.[0]?.getUrl({ maxWidth: 400, maxHeight: 400 }) || null,
                    placeId: place.place_id,
                    location: place.geometry.location,
                  });
                }
              });
            }
            pending -= 1;
            if (pending === 0) {
              const sorted = collected.sort((a, b) => (b.rating || 0) - (a.rating || 0));
              setPoiResults(sorted);
              setPoiLoading(false);
              sorted.forEach((place) => {
                const marker = new window.google.maps.Marker({
                  position: place.location,
                  map: mapInstanceRef.current,
                  title: place.name,
                  icon: { url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png' },
                });
                const infoWindow = new window.google.maps.InfoWindow({
                  content: `<div style="font-family:Inter,sans-serif;font-size:13px;max-width:160px"><strong>${place.name}</strong>${place.rating ? `<br/>⭐ ${place.rating.toFixed(1)}` : ''}<br/><span style="color:#6B7280;font-size:11px">${place.vicinity}</span></div>`,
                });
                marker.addListener('click', () => infoWindow.open(mapInstanceRef.current, marker));
                poiMarkersRef.current.push(marker);
              });
            }
          }
        );
      });
    });
  }, [selectedIdx]);
  const stopAutocompleteRef = useRef(null);
  const stopGeocoderRef = useRef(null);
  const stopContainerRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [navStepIndex, setNavStepIndex] = useState(0);
  const [navInstruction, setNavInstruction] = useState('');
  const [navDistance, setNavDistance] = useState('');
  const [navArrived, setNavArrived] = useState(false);
  const userLocationRef = useRef(null);
  // Cache actual API minutes per mode so inactive buttons show accurate estimates
  const modeMinutesCache = useRef({});
  const activeRoutePairRef = useRef({ origin: null, destination: null });

  const directionsResultRef = useRef(null);
  const selectRouteRef = useRef(null);
  const originChosenRef = useRef(false); // true only after user explicitly picks a start
  const navWatchIdRef = useRef(null);

  const selectedRoute = routes[selectedIdx] || routes[0] || null;
  const selectedRouteMinutes = parseDurationToMinutes(selectedRoute?.duration);
  // Always base estimates on the driving route minutes, not the current mode
  const drivingMinutesRef = useRef(0);

  const tooltipRef = useRef(null);
  const routeLabelsRef = useRef([]);
  const floodLabelsRef = useRef([]);
  const floodPollRef = useRef(null);
  const RouteLabelClassRef = useRef(null);
  const poiMarkersRef = useRef([]);
  const pathClickLabelRef = useRef(null);

  const [floodDetected, setFloodDetected] = useState(false);

  const getRouteLabelClass = () => {
    if (RouteLabelClassRef.current) return RouteLabelClassRef.current;
    RouteLabelClassRef.current = class RouteLabel extends window.google.maps.OverlayView {
      constructor(pos, html, onClick) {
        super();
        this.pos = pos;
        this.html = html;
        this.div = null;
        this._onClick = onClick || null;
      }
      onAdd() {
        this.div = document.createElement('div');
        const clickable = !!this._onClick;
        this.div.style.cssText = `position:absolute;pointer-events:${clickable ? 'auto' : 'none'};transform:translate(-50%,-50%);z-index:1000;${clickable ? 'cursor:pointer;' : ''}`;
        this.div.innerHTML = this.html;
        if (this._onClick) {
          this.div.addEventListener('click', this._onClick);
        }
        this.getPanes().floatPane.appendChild(this.div);
      }
      draw() {
        const p = this.getProjection()?.fromLatLngToDivPixel(this.pos);
        if (p && this.div) { this.div.style.left = p.x + 'px'; this.div.style.top = p.y + 'px'; }
      }
      onRemove() {
        if (this.div) { this.div.parentNode?.removeChild(this.div); this.div = null; }
      }
    };
    return RouteLabelClassRef.current;
  };

  const createRouteLabel = (map, position, content, onClick) => {
    const LabelClass = getRouteLabelClass();
    const label = new LabelClass(position, content, onClick);
    label.setMap(map);
    return label;
  };

  const hideTooltip = () => {};

  const sanitizeInstruction = (html = '') => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const formatDistance = (meters) => {
    if (!Number.isFinite(meters)) return '';
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
    return `${Math.max(1, Math.round(meters))} m`;
  };

  const toRad = (val) => (val * Math.PI) / 180;
  const getDistanceMeters = (a, b) => {
    if (!a || !b) return null;
    const lat1 = a.lat;
    const lng1 = a.lng;
    const lat2 = typeof b.lat === 'function' ? b.lat() : b.lat;
    const lng2 = typeof b.lng === 'function' ? b.lng() : b.lng;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const s1 = Math.sin(dLat / 2) ** 2;
    const s2 = Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(s1 + s2), Math.sqrt(1 - (s1 + s2)));
    return R * c;
  };

  const updateNavigation = useCallback((loc, forcedIndex = null) => {
    const result = directionsResultRef.current;
    const leg = result?.routes?.[selectedIdx]?.legs?.[0];
    const steps = leg?.steps || [];
    if (!steps.length) {
      setNavInstruction('Heading to destination');
      setNavDistance('');
      return;
    }

    let idx = forcedIndex != null ? forcedIndex : navStepIndex;
    if (idx >= steps.length) idx = steps.length - 1;
    const currentStep = steps[idx];
    const distanceToEnd = getDistanceMeters(loc, currentStep?.end_location);

    if (distanceToEnd != null && distanceToEnd < 30 && idx < steps.length - 1) {
      idx += 1;
      setNavStepIndex(idx);
    } else if (forcedIndex != null) {
      setNavStepIndex(idx);
    }

    const step = steps[idx] || currentStep;
    if (step) {
      setNavInstruction(sanitizeInstruction(step.instructions || step.html_instructions || 'Continue'));
      const stepMeters = getDistanceMeters(loc, step.end_location);
      setNavDistance(formatDistance(stepMeters));
      setNavArrived(idx >= steps.length - 1 && (stepMeters != null && stepMeters < 40));
    }
  }, [navStepIndex, selectedIdx]);

  const clearPoiMarkers = () => {
    poiMarkersRef.current.forEach((m) => m.setMap(null));
    poiMarkersRef.current = [];
  };

  const clearPathClickLabel = () => {
    if (pathClickLabelRef.current) {
      pathClickLabelRef.current.setMap(null);
      pathClickLabelRef.current = null;
    }
  };

  const clearFloodOverlays = () => {
    floodLabelsRef.current.forEach((label) => label.setMap(null));
    floodLabelsRef.current = [];
  };

  const clearRouteOverlays = () => {
    renderersRef.current.forEach((renderer) => renderer.setMap(null));
    clickPathsRef.current.forEach((path) => path.setMap(null));
    routeLabelsRef.current.forEach((label) => label.setMap(null));
    clearFloodOverlays();
    clearPathClickLabel();
    renderersRef.current = [];
    clickPathsRef.current = [];
    routeLabelsRef.current = [];
  };

  const drawSelectedRoute = (idx) => {
    const result = directionsResultRef.current;
    if (!result || !mapInstanceRef.current) return;

    clearRouteOverlays();
    setSelectedIdx(idx);

    result.routes.forEach((route, i) => {
      const isSelected = i === idx;

      if (isSelected) {
        const renderer = new window.google.maps.DirectionsRenderer({
          map: mapInstanceRef.current,
          directions: result,
          routeIndex: i,
          suppressInfoWindows: true,
          polylineOptions: {
            strokeColor: '#1A73E8',
            strokeWeight: 5,
            strokeOpacity: 1,
            zIndex: 10,
            clickable: false,
          },
        });
        renderersRef.current.push(renderer);
      } else {
        const polyline = new window.google.maps.Polyline({
          path: route.overview_path,
          map: mapInstanceRef.current,
          strokeColor: '#9E9E9E',
          strokeWeight: 4,
          strokeOpacity: 0.85,
          zIndex: 1,
          clickable: false,
        });
        // White border effect for alternative routes (like Google Maps)
        const polylineBorder = new window.google.maps.Polyline({
          path: route.overview_path,
          map: mapInstanceRef.current,
          strokeColor: '#00b3f4',
          strokeWeight: 7,
          strokeOpacity: 0.5,
          zIndex: 0,
          clickable: false,
        });
        renderersRef.current.push(polylineBorder);
        renderersRef.current.push(polyline);
      }

      const clickPath = new window.google.maps.Polyline({
        path: route.overview_path,
        map: mapInstanceRef.current,
        strokeOpacity: 0,
        strokeWeight: 40,
        zIndex: 20,
        clickable: true,
      });

      if (i === idx) {
        const leg = result.routes[i]?.legs?.[0];
        const duration = leg?.duration_in_traffic?.text || leg?.duration?.text || '--';
        const distanceKm = leg?.distance?.text || '--';
        const modeConfig = MODE_CONFIGS.find(m => m.key === selectedMode) || MODE_CONFIGS[0];
        const labelHtml = `
          <div style="background:linear-gradient(135deg,#fff 0%,#EFF6FF 100%);border-radius:12px;box-shadow:0 4px 16px rgba(26,115,232,0.18);padding:10px 14px;font-family:Inter,sans-serif;pointer-events:none;white-space:nowrap;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
              <img src="${modeConfig.icon}" style="width:20px;height:20px;object-fit:contain"/>
              <span style="font-weight:700;font-size:14px;color:#122E63">${duration}</span>
            </div>
            <div style="font-size:13px;color:#374151">${distanceKm}</div>
          </div>`;

        clickPath.addListener('mousemove', (e) => {
          clearPathClickLabel();
          pathClickLabelRef.current = createRouteLabel(mapInstanceRef.current, e.latLng, labelHtml);
        });
        clickPath.addListener('mouseout', () => clearPathClickLabel());
        clickPath.addListener('click', () => clearPathClickLabel());
      } else {
        clickPath.addListener('click', () => selectRouteRef.current(i));
      }

      // Permanent label at route midpoint
      const path = route.overview_path;
      const midPoint = path[Math.floor(path.length / 2)];
      const leg = result.routes[i]?.legs?.[0];
      const duration = leg?.duration_in_traffic?.text || leg?.duration?.text || '--';
      const distance = leg?.distance?.text || '--';
      const freeMins = leg?.duration?.value ? Math.round(leg.duration.value / 60) : 0;
      const trafficMins = leg?.duration_in_traffic?.value
        ? Math.round(leg.duration_in_traffic.value / 60)
        : freeMins;
      const ratio = freeMins > 0 ? trafficMins / freeMins : 1;
      const traffic = ratio >= 1.4 ? 'Heavy traffic' : ratio >= 1.15 ? 'Moderate traffic' : 'Light traffic';
      const trafficAvailable = leg?.duration_in_traffic?.value != null;
      const hasTrafficDelay = trafficAvailable && trafficMins > freeMins;
      const shouldShowTrafficLabel = !showDetailsPanel && isSelected && (
        traffic === 'Heavy traffic' || traffic === 'Moderate traffic'
      );
      if (!showDetailsPanel) {
        // Add a clickable overlay for ETA label
        const labelContent = `
          <div id="eta-label-overlay" style="width:189.99635314941406px;height:101.90234375px;border-radius:10px;background:linear-gradient(90deg, #FFFFFF 0%, #A0DBFF 100%);box-shadow:0px 2px 2px 0px #00000040;display:flex;flex-direction:column;justify-content:center;padding:12px 16px;gap:8px;cursor:pointer;">
            <div style="display:flex;align-items:center;gap:8px;">
              <img src="${carIcon}" style="width:18px;height:18px;object-fit:contain" />
              <span style="font-weight:600;color:#111827;font-size:14px;">${distance}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <img src="${clockIcon}" style="width:18px;height:18px;object-fit:contain" />
              <span style="font-weight:600;color:#111827;font-size:14px;">ETA: ${duration}</span>
            </div>
          </div>`;
        const etaClickHandler = () => {
          if (typeof window.setActivePageGlobal === 'function') {
            window.setActivePageGlobal('eta');
          }
          if (typeof window.setEtaTitleGlobal === 'function') {
            window.setEtaTitleGlobal(`ETA: ${duration}`);
          }
          if (typeof window.setEtaDataGlobal === 'function') {
            window.setEtaDataGlobal({
              distance,
              duration,
              durationMinutes: trafficMins || freeMins,
              traffic,
              mode: selectedMode,
            });
          }
        };
        const label = createRouteLabel(mapInstanceRef.current, midPoint, labelContent, etaClickHandler);
        routeLabelsRef.current.push(label);
      }

      if (shouldShowTrafficLabel) {
        const trafficLabel = `
          <div style="transform:translateY(42px);width:180px;height:42px;border-radius:12px;background:#E8CC1C;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0px 2px 2px 0px #00000040;">
            <svg width="22" height="20" viewBox="0 0 48 44" aria-hidden="true">
              <path d="M24 3.5L3.5 39.5c-.7 1.2.2 2.7 1.6 2.7h38c1.4 0 2.3-1.5 1.6-2.7L24 3.5z" fill="none" stroke="#E53935" strokeWidth="4" />
              <circle cx="24" cy="30" r="2.6" fill="#E53935" />
              <line x1="24" y1="14" x2="24" y2="26" stroke="#E53935" strokeWidth="4" strokeLinecap="round" />
            </svg>
            <span style="font-weight:700;font-size:12px;color:#000;white-space:nowrap;">Traffic</span>
          </div>`;
        const trafficOverlay = createRouteLabel(mapInstanceRef.current, midPoint, trafficLabel);
        routeLabelsRef.current.push(trafficOverlay);
      }

      // ── Flood label (shown separately at 1/3 point of the route) ──
      // Drawn asynchronously after route is confirmed; see checkAndDrawFloodLabel below.

      clickPathsRef.current.push(clickPath);
    });
  };

  const requestDirections = (origin, destinationLocation, modeKey) => {
    if (!window.google?.maps || !mapInstanceRef.current) return;

    activeRoutePairRef.current = { origin, destination: destinationLocation };
    const modeConfig = MODE_CONFIGS.find((mode) => mode.key === modeKey) || MODE_CONFIGS[0];
    const directionsService = new window.google.maps.DirectionsService();
    const requestId = ++routeRequestIdRef.current;

    setLoadingRoutes(true);
    setError(null);
    clearRouteOverlays();

    const tryRoute = (travelMode) => {
      directionsService.route(
        {
          origin,
          destination: destinationLocation,
          travelMode: window.google.maps.TravelMode[travelMode],
          provideRouteAlternatives: true,
          drivingOptions: travelMode === 'DRIVING' ? {
            departureTime: new Date(),
            trafficModel: window.google.maps.TrafficModel.BEST_GUESS,
          } : undefined,
          ...(travelMode === 'TRANSIT' ? { transitOptions: { departureTime: new Date() } } : {}),
        },
        (result, status) => {
          if (requestId !== routeRequestIdRef.current) return;

          if (status !== window.google.maps.DirectionsStatus.OK) {
            // BICYCLING and TRANSIT not supported in Sri Lanka — fall back to DRIVING
            if (travelMode === 'BICYCLING' || travelMode === 'TRANSIT') {
              setFallbackMode(true);
              tryRoute('DRIVING');
              return;
            }
            setLoadingRoutes(false);
            setError('Could not find a route to this destination.');
            setRoutes([]);
            directionsResultRef.current = null;
            return;
          }

          setLoadingRoutes(false);
          setFallbackMode(false);
          directionsResultRef.current = result;

          const routeInfoList = result.routes.map((route) => {
            const leg = route.legs[0];
            const freeMins = leg.duration?.value ? Math.round(leg.duration.value / 60) : 0;
            const trafficMins = leg.duration_in_traffic?.value
              ? Math.round(leg.duration_in_traffic.value / 60)
              : freeMins;
            const ratio = freeMins > 0 ? trafficMins / freeMins : 1;
            const traffic =
              ratio >= 1.4 ? 'Heavy traffic'
              : ratio >= 1.15 ? 'Moderate traffic'
              : 'Light traffic';
            return {
              duration: leg.duration_in_traffic?.text || leg.duration?.text || '--',
              durationMinutes: trafficMins || freeMins,
              distance: leg.distance?.text || '--',
              summary: route.summary || 'Suggested route',
              traffic,
            };
          });

          setRoutes(routeInfoList);
          setSelectedIdx(0);
          drawSelectedRoute(0);

          // Real-time flood check on the selected route
          if (!showDetailsPanel) {
            const selectedGoogleRoute = result.routes[0];
            const overviewPath = selectedGoogleRoute?.overview_path || [];
            checkAndDrawFloodLabel(overviewPath);
            // Poll every 5 minutes
            if (floodPollRef.current) clearInterval(floodPollRef.current);
            floodPollRef.current = setInterval(() => {
              checkAndDrawFloodLabel(overviewPath);
            }, 5 * 60 * 1000);
          }
          // Cache this mode's actual minutes
          modeMinutesCache.current[modeConfig.key] = routeInfoList[0]?.durationMinutes || 0;
          if (travelMode === 'DRIVING') {
            drivingMinutesRef.current = routeInfoList[0]?.durationMinutes || 0;
          }
        }
      );
    };

    tryRoute(modeConfig.travelMode);
  };

  const selectRoute = (idx) => {
    drawSelectedRoute(idx);
  };

  selectRouteRef.current = selectRoute;

  /**
   * Checks the given overviewPath for flood conditions via OpenWeatherMap,
   * then draws (or removes) the yellow flood-warning label on the map.
   * Position: 1/3 along the route to avoid overlapping the ETA/traffic labels.
   */
  const checkAndDrawFloodLabel = async (overviewPath) => {
    if (!mapInstanceRef.current || !overviewPath?.length || showDetailsPanel) return;
    clearFloodOverlays();
    const { isFlood } = await checkRouteForFlood(overviewPath);
    setFloodDetected(isFlood);
    if (!isFlood) return;

    // Place label at 1/3 of the path (away from the ETA label at midpoint)
    const thirdPoint = overviewPath[Math.floor(overviewPath.length / 3)];
    if (!thirdPoint) return;

    const floodLabel = `
      <div style="
        transform: translateY(-60px);
        width: 220px;
        height: 44px;
        border-radius: 12px;
        background: #E8CC1C;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        box-shadow: 0px 2px 6px rgba(0,0,0,0.28);
        padding: 0 14px;
      ">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            fill="none" stroke="#E53935" stroke-width="1.8" stroke-linejoin="round"/>
          <line x1="12" y1="9" x2="12" y2="13" stroke="#E53935" stroke-width="1.8" stroke-linecap="round"/>
          <circle cx="12" cy="17" r="1" fill="#E53935"/>
        </svg>
        <span style="font-weight:700;font-size:11px;color:#000;white-space:nowrap;">Caution : Flooded area ahead</span>
      </div>`;

    const overlay = createRouteLabel(mapInstanceRef.current, thirdPoint, floodLabel);
    floodLabelsRef.current.push(overlay);
  };

  const placeOriginMarker = (loc) => {
    if (originMarkerRef.current) {
      originMarkerRef.current.setPosition(loc);
    } else {
      originMarkerRef.current = new window.google.maps.Marker({
        position: loc,
        map: mapInstanceRef.current,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#104bc0',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
      });
    }
  };

  const applyOrigin = useCallback((loc, label, fireRoute = true) => {
    userLocationRef.current = loc;
    setOriginLabel(label);
    placeOriginMarker(loc);
    if (fireRoute) {
      originChosenRef.current = true;
      const dest = destPlace || searchedPlace;
      requestDirections(loc, dest?.geometry?.location || destination, selectedMode);
    }
  }, [selectedMode, destPlace, searchedPlace, destination]);

  const onOriginSelect = useCallback((place) => {
    const loc = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
    applyOrigin(loc, place.displayName);
  }, [applyOrigin]);

  const onDestSelect = useCallback((place) => {
    setDestPlace(place);
    setSearchedPlace(place);
    if (userLocationRef.current) {
      const loc = place.geometry.location;
      if (destMarkerRef.current) {
        destMarkerRef.current.setPosition({ lat: loc.lat(), lng: loc.lng() });
      } else if (mapInstanceRef.current) {
        destMarkerRef.current = new window.google.maps.Marker({
          position: { lat: loc.lat(), lng: loc.lng() },
          map: mapInstanceRef.current,
          icon: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
        });
      }
      requestDirections(userLocationRef.current, loc, selectedMode);
    }
  }, [selectedMode]);

  const handleGpsSearch = useCallback(() => {
    if (!navigator.geolocation) return;

    if (navWatchIdRef.current != null) {
      navigator.geolocation.clearWatch(navWatchIdRef.current);
      navWatchIdRef.current = null;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        userLocationRef.current = loc;
        applyOrigin(loc, 'Your location', true);
        mapInstanceRef.current?.panTo(loc);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  }, [applyOrigin]);

  useEffect(() => {
    ensureMapsScript(() => {
      const destLoc = (destPlace || searchedPlace)?.geometry?.location;
      const initialCenter = destLoc ? { lat: destLoc.lat(), lng: destLoc.lng() } : { lat: 7.8731, lng: 80.7718 };

      // Clear pending values now that we've consumed them
      if (pendingOriginLabel) setPendingOriginLabel('');
      if (pendingVehicle) setPendingVehicle(null);

      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: initialCenter,
        zoom: destLoc ? 12 : 7,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
        gestureHandling: 'cooperative',
        styles: [
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#a2daf2' }] },
          { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#d0f0c0' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
          { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#9be79b' }] },
          { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#6abf69' }] },
        ],
      });
      setMapReady(true);

      if (!trafficLayerRef.current) {
        trafficLayerRef.current = new window.google.maps.TrafficLayer();
      }
      trafficLayerRef.current.setMap(mapInstanceRef.current);

      // Place destination marker — no route yet
      if (destLoc) {
        destMarkerRef.current = new window.google.maps.Marker({
          position: { lat: destLoc.lat(), lng: destLoc.lng() },
          map: mapInstanceRef.current,
          icon: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
        });
      }

      // Map click disabled — user must use the input to set origin

      // Silently detect user location — place marker only, no route
      if (userLocation) {
        applyOrigin(userLocation, 'Your location', Boolean(destLoc));
      } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            applyOrigin(loc, 'Your location', Boolean(destLoc));
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );
      }
    });
    return () => {
      routeRequestIdRef.current += 1;
      clearRouteOverlays();
      if (floodPollRef.current) clearInterval(floodPollRef.current);
    };
  }, []);

  useEffect(() => {
    if (!mapReady || showDetailsPanel || !navigator.geolocation) return;

    if (navWatchIdRef.current != null) {
      navigator.geolocation.clearWatch(navWatchIdRef.current);
    }

    navWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        userLocationRef.current = loc;
        placeOriginMarker(loc);
        mapInstanceRef.current?.panTo(loc);
        updateNavigation(loc);
        if (!directionsResultRef.current) {
          const dest = destPlace || searchedPlace;
          const destLoc = dest?.geometry?.location || destination;
          requestDirections(loc, destLoc, selectedMode);
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    return () => {
      if (navWatchIdRef.current != null) {
        navigator.geolocation.clearWatch(navWatchIdRef.current);
        navWatchIdRef.current = null;
      }
    };
  }, [mapReady, showDetailsPanel, destPlace, searchedPlace, destination, selectedMode, updateNavigation]);

  useEffect(() => {
    if (!mapInstanceRef.current || !originChosenRef.current) return;
    const { origin, destination: currentDestination } = activeRoutePairRef.current;
    if (!origin || !currentDestination) return;

    requestDirections(origin, currentDestination, selectedMode);
  }, [selectedMode]);

  useEffect(() => {
    if (searchedPlace) {
      setDestPlace(searchedPlace);
    }
  }, [searchedPlace]);

  useEffect(() => {
    setNavStepIndex(0);
    setNavArrived(false);
    if (userLocationRef.current) {
      updateNavigation(userLocationRef.current, 0);
    }
  }, [routes, selectedIdx, updateNavigation]);

  useEffect(() => {
    if (!mapInstanceRef.current || originChosenRef.current) return;
    const dest = destPlace || searchedPlace;
    const destLoc = dest?.geometry?.location;
    if (userLocationRef.current && destLoc) {
      originChosenRef.current = true;
      requestDirections(userLocationRef.current, destLoc, selectedMode);
    }
  }, [destPlace, searchedPlace, selectedMode]);

  const handleSwap = () => {
    const { origin, destination: currentDestination } = activeRoutePairRef.current;
    if (!origin || !currentDestination || !mapInstanceRef.current) return;

    const nextSwapped = !swapped;
    setSwapped(nextSwapped);
    setError(null);

    requestDirections(
      nextSwapped ? currentDestination : origin,
      nextSwapped ? origin : currentDestination,
      selectedMode
    );
  };

  const handleShare = async () => {
    const shareText = `Route to ${destination}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Direction route',
          text: shareText,
        });
        setActionMessage('Route shared.');
      } else {
        await navigator.clipboard.writeText(shareText);
        setActionMessage('Route copied to clipboard.');
      }
    } catch {
      setActionMessage('Share cancelled.');
    }
  };

  const handleSave = () => {
    const savedRoute = {
      destination,
      origin: userLocationRef.current,
      mode: selectedMode,
      updatedAt: new Date().toISOString(),
    };

    window.localStorage.setItem('savedDirectionRoute', JSON.stringify(savedRoute));
    setActionMessage('Route saved.');
  };

  const handleStart = () => {
    if (setActivePage) {
      setActivePage('start');
      setActionMessage('Opening start page.');
    }
  };

  const handleSafetyAlert = () => {
    const routePath = directionsResultRef.current?.routes?.[selectedIdx]?.overview_path || [];
    if (typeof setSafetyData === 'function') {
      setSafetyData({
        origin: originLabel || userLocationRef.current || null,
        destination,
        mode: selectedMode,
        routePath: routePath.map((point) => ({
          lat: typeof point.lat === 'function' ? point.lat() : point.lat,
          lng: typeof point.lng === 'function' ? point.lng() : point.lng,
        })),
      });
    }
    setActivePage && setActivePage('safety');
  };

  const handleAddStop = () => {
    setAddStopOpen(true);
    setStopQuery('');
    setStopSuggestions([]);
    setActiveCategory(null);
    setStopPanelCollapsed(false);

    ensureMapsScript(() => {
      stopAutocompleteRef.current = new window.google.maps.places.AutocompleteService();
      stopGeocoderRef.current = new window.google.maps.Geocoder();
      // Auto-load high-rated attractions along the route
      searchAttractionsAlongRoute();
    });
  };

  const fetchStopSuggestions = useCallback((input) => {
    if (!input.trim()) { setStopSuggestions([]); return; }
    const result = directionsResultRef.current;
    if (!result || !mapInstanceRef.current) {
      // No route yet — fall back to country-wide autocomplete
      if (!stopAutocompleteRef.current) { setStopSuggestions([]); return; }
      stopAutocompleteRef.current.getPlacePredictions(
        { input, componentRestrictions: { country: 'lk' } },
        (predictions, status) => {
          setStopSuggestions(
            status === window.google.maps.places.PlacesServiceStatus.OK && predictions ? predictions : []
          );
        }
      );
      return;
    }

    const path = result.routes[selectedIdx]?.overview_path || [];
    if (!path.length) { setStopSuggestions([]); return; }

    // Build a tight LatLngBounds around the route path
    const bounds = new window.google.maps.LatLngBounds();
    path.forEach((pt) => bounds.extend(pt));

    // Use autocomplete biased to the route bounding box
    if (!stopAutocompleteRef.current) { setStopSuggestions([]); return; }
    stopAutocompleteRef.current.getPlacePredictions(
      { input, bounds, strictBounds: true, componentRestrictions: { country: 'lk' } },
      (predictions, status) => {
        if (status !== window.google.maps.places.PlacesServiceStatus.OK || !predictions) {
          setStopSuggestions([]);
          return;
        }
        // Further filter: only keep predictions whose location is within 1km of the route
        const geocoder = stopGeocoderRef.current;
        if (!geocoder) { setStopSuggestions(predictions.slice(0, 5)); return; }
        const filtered = [];
        let remaining = predictions.length;
        predictions.forEach((p) => {
          geocoder.geocode({ placeId: p.place_id }, (geoResults, geoStatus) => {
            if (geoStatus === 'OK' && geoResults?.[0]) {
              const dist = getDistanceToPath(geoResults[0].geometry.location, path);
              if (dist <= 1000) filtered.push(p);
            }
            remaining -= 1;
            if (remaining === 0) setStopSuggestions(filtered.slice(0, 5));
          });
        });
      }
    );
  }, [selectedIdx]);
  useEffect(() => {
    if (addStopOpen && activeCategory) searchPlacesAlongRoute(activeCategory);
  }, [selectedIdx]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const timer = setTimeout(() => {
      window.google?.maps?.event?.trigger(mapInstanceRef.current, 'resize');
    }, 500);
    return () => clearTimeout(timer);
  }, [stopPanelCollapsed]);

  const baseModeMinutes = selectedMode === 'drive'
    ? (selectedRouteMinutes || drivingMinutesRef.current || 215)
    : (drivingMinutesRef.current || selectedRouteMinutes || 215);

  const isStartPage = !showDetailsPanel;
  const bannerTitle = isStartPage
    ? (navInstruction ? `${navInstruction}${navDistance ? ` in ${navDistance}` : ''}` : 'Calculating route...')
    : (navInstruction || 'Calculating route...');
  const mapHeight = showDetailsPanel ? (addStopOpen && !stopPanelCollapsed ? '450px' : '900px') : 'calc(100vh + 80px)';

  return (
    <div className="relative w-full bg-[#edf7ff]" style={{ minHeight: showDetailsPanel ? '50%' : mapHeight }}>
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
        <img src={middle} alt="Ocean background" className="w-full h-full object-cover scale-x-[1.7]" />
      </div>

      <div className="relative z-10 w-full">
        <div className="relative w-full" style={{ height: mapHeight, transition: 'height 0.35s ease' }}>
          <div ref={mapRef} className="h-full w-full shadow-[0_18px_50px_rgba(18,46,99,0.12)]" />
          <div
            className="absolute right-4 z-30"
            style={{ bottom: '200px', pointerEvents: 'none' }}
          >
            <button
              type="button"
              onClick={handleGpsSearch}
              aria-label="Use current location"
              style={{
                  pointerEvents: 'auto',
                  width: '45px',
                  height: '45px',
                  borderRadius: '16px',
                  border: 'none',
                  background: '#1A73E8',
                  boxShadow: '0 10px 24px rgba(26,115,232,0.28)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  position: 'absolute',        // anchor positioning
                  right: '0px',                // stick to right corner
                  bottom: 'var(--gps-margin, 8px)' // adjustable bottom margin
      
              }}
            >
              <img src={gpsIcon} alt="GPS search" style={{ width: '25px', height: '25px' }} />
            </button>
          </div>
          {!showDetailsPanel && (
            <div className="absolute left-1/2 top-6 z-20 w-[90%] max-w-[720px] -translate-x-1/2">
              <div className="flex items-center gap-4 rounded-2xl bg-white/95 px-5 py-4 shadow-lg backdrop-blur">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1A73E8] text-white">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-base font-semibold text-slate-900">
                    {navArrived ? 'Arrived at destination' : bannerTitle}
                  </span>
                  {isStartPage && destination && !navArrived && (
                    <span className="text-sm text-slate-500">To {destination}</span>
                  )}
                  {!isStartPage && navDistance && !navArrived && (
                    <span className="text-sm text-slate-500">in {navDistance}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>


        {!showDetailsPanel && (
          <div className="flex items-center justify-center" style={{ marginTop: '150px', marginBottom: '150px', gap: '200px' }}>
            <button
              type="button"
              onClick={() => {
                setHasSearched(true);
                setActivePage && setActivePage('explore');
              }}
              className="rounded-xl bg-[#e53e3e] px-10 py-3 text-base font-semibold text-white hover:bg-[#c53030]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setActivePage && setActivePage('safety')}
              className="rounded-xl bg-[#1A73E8] px-10 py-3 text-base font-semibold text-white hover:bg-[#165fbe]"
            >
              Safety Alert
            </button>
          </div>
        )}

        {addStopOpen && (
          <div style={{
            width: '100%',
            background: '#D7EEFD',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            maxHeight: stopPanelCollapsed ? '56px' : '2000px',
            transition: 'max-height 0.4s cubic-bezier(0.4,0,0.2,1)',
          }}>
            {/* Slide handle icon */}
            <div
              onClick={() => setStopPanelCollapsed(c => !c)}
              style={{ display: 'flex', justifyContent: 'center', paddingTop: '10px', marginBottom: '4px', cursor: 'pointer' }}
            >
              <svg
                width="36" height="36" viewBox="0 0 24 24" fill="none"
                stroke="#1A73E8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{
                  transition: 'transform 0.4s cubic-bezier(0.4,0,0.2,1)',
                  transform: stopPanelCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
                  filter: 'drop-shadow(0 1px 2px rgba(26,115,232,0.18))',
                }}
              >
                <circle cx="12" cy="12" r="10" stroke="#1A73E8" strokeWidth="1.5" fill="#EFF6FF" />
                <polyline points="8 11 12 15 16 11" />
              </svg>
            </div>
            <div style={{ padding: '0 32px 24px' }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '20px', color: '#122E63', marginLeft: '4%' }}>
              Add stop to your route
            </span>

            {/* Search bar */}
            <div ref={stopContainerRef} style={{ position: 'relative', marginTop: '50px', marginLeft: '4%', marginBottom: '35px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'linear-gradient(135deg, #ffffff 0%, #A0DBFF 100%)',
                borderRadius: '999px', padding: '10px 16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                marginRight: '60%',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  value={stopQuery}
                  onChange={(e) => { setStopQuery(e.target.value); setStopActiveIdx(-1); fetchStopSuggestions(e.target.value); }}
                  onKeyDown={(e) => {
                    if (!stopSuggestions.length) return;
                    if (e.key === 'ArrowDown') { setStopActiveIdx(i => Math.min(i + 1, stopSuggestions.length - 1)); e.preventDefault(); }
                    else if (e.key === 'ArrowUp') { setStopActiveIdx(i => Math.max(i - 1, -1)); e.preventDefault(); }
                    else if (e.key === 'Escape') setStopSuggestions([]);
                  }}
                  placeholder="Search along route"
                  style={{ flex: 1, border: 'none', outline: 'none', fontSize: '14px', color: '#333', background: 'transparent' }}
                />
                {stopQuery && (
                  <svg onClick={() => { setStopQuery(''); setStopSuggestions([]); }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: 'pointer', flexShrink: 0 }}>
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                )}
              </div>

              {stopSuggestions.length > 0 && (
                <ul style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                  background: '#fff', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                  zIndex: 9999, listStyle: 'none', margin: 0, padding: '4px 0',
                  maxHeight: '220px', overflowY: 'auto',
                }}>
                  {stopSuggestions.map((p, i) => (
                    <li
                      key={p.place_id}
                      onMouseDown={() => { setStopQuery(p.structured_formatting.main_text); setStopSuggestions([]); }}
                      onMouseEnter={() => setStopActiveIdx(i)}
                      style={{
                        padding: '10px 16px', cursor: 'pointer', fontSize: '14px', color: '#333',
                        background: i === stopActiveIdx ? '#EFF6FF' : 'transparent',
                        display: 'flex', alignItems: 'center', gap: '8px',
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                      </svg>
                      <span>
                        <strong>{p.structured_formatting.main_text}</strong>
                        {p.structured_formatting.secondary_text && (
                          <span style={{ color: '#6B7280', marginLeft: 4 }}>{p.structured_formatting.secondary_text}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Category menu bar */}
            <div style={{ marginTop: '20px'}}>
              <div style={{ display: 'flex', gap: '25%',marginLeft: '2%' }}>
                {['Restaurant', 'Petrol Station', 'Coffee Shop', 'Supermarket'].map((item) => (
                  <span
                    key={item}
                    onClick={() => { setActiveCategory(item); searchPlacesAlongRoute(item); }}
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '14px',
                      fontWeight: activeCategory === item ? 700 : 500,
                      color: activeCategory === item ? '#1A73E8' : '#122E63',
                      cursor: 'pointer',
                      paddingBottom: '10px',
                      transition: 'color 0.15s, font-weight 0.15s',
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>
              <div style={{ height: '2px', background: '#1A73E8', borderRadius: '1px' }} />
            </div>

            {/* Point of Interest */}
            <span style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '15px',
              fontWeight: 500,
              color: '#122E63',
              marginTop: '28px',
              marginBottom: '20px',
              display: 'block',
            }}>
              Point of Interest
            </span>

            {/* POI Results */}
            {poiLoading && (
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#1A73E8', marginLeft: '2%' }}>
                Searching along route...
              </p>
            )}
            {!poiLoading && poiResults.length === 0 && (
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#6B7280', marginLeft: '2%' }}>
                {activeCategory ? `No ${activeCategory.toLowerCase()} found along this route.` : 'No attractions found within 2 km of your route.'}
              </p>
            )}
            {!poiLoading && poiResults.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px', paddingBottom: '8px', marginLeft: '2%', maxHeight: '520px', overflowY: 'auto' }}>
                {poiResults.map((place) => (
                  <div key={place.placeId}
                    onClick={() => {
                      poiMarkersRef.current.forEach((m) => {
                        const isSelected = m.getTitle() === place.name;
                        m.setMap(isSelected ? mapInstanceRef.current : null);
                        if (isSelected && mapInstanceRef.current) {
                          mapInstanceRef.current.panTo(m.getPosition());
                          mapInstanceRef.current.setZoom(16);
                        }
                      });
                      setStopPanelCollapsed(true);
                    }}
                    style={{
                      background: '#fff', borderRadius: '10px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                      overflow: 'hidden', cursor: 'pointer',
                    }}>
                    <div style={{ width: '100%', height: '160px', overflow: 'hidden', flexShrink: 0 }}>
                      {place.photo
                        ? <img src={place.photo} alt={place.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.style.background = '#e0eeff'; e.target.parentNode.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1A73E8" stroke-width="1.5" style="margin:auto;display:block;margin-top:64px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>'; }}
                          />
                        : <div style={{ width: '100%', height: '100%', background: '#e0eeff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1A73E8" strokeWidth="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                          </div>
                      }
                    </div>
                    <div style={{ padding: '8px 10px' }}>
                      <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '13px', color: '#111', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{place.name}</p>
                      {place.rating && <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#F5A623', margin: '4px 0 0' }}>{'★'.repeat(Math.round(place.rating))} {place.rating.toFixed(1)}</p>}
                      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#6B7280', margin: '4px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{place.vicinity}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            </div>
            <button
              onClick={() => { setAddStopOpen(false); clearPoiMarkers(); setPoiResults([]); setActiveCategory(null); }}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <img src={closeIcon} alt="Close" style={{ width: '28px', height: '28px' }} />
            </button>
          </div>
        )}

        {showDetailsPanel && !addStopOpen && (
          <div style={{ maxWidth: '100%', margin: '0 auto', padding: 0 }}>
            {/* Slide toggle tab */}
            {!panelOpen && (
              <div
                onClick={() => setPanelOpen(true)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', background: '#fff', borderRadius: '12px 12px 0 0',
                  padding: '6px 24px', boxShadow: '0 -2px 8px rgba(0,0,0,0.08)',
                  width: 'fit-content', margin: '0 auto',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1A73E8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="18 15 12 9 6 15" />
                </svg>
              </div>
            )}
            <div
              style={{
                overflow: 'hidden',
                maxHeight: panelOpen ? '1000px' : '0px',
                transition: 'max-height 0.4s cubic-bezier(0.4,0,0.2,1)',
              }}
            >
            <div className="overflow-hidden rounded-[1px] border border-white/70 bg-white/95 shadow-[0_30px_80px_rgba(18,46,99,0.18)] backdrop-blur-md">
              <div className="px-5 py-4 sm:px-8">
                {/* Heading + share/close icons row */}
                <div className="flex items-center justify-between mb-12 mt-12">
                  <h2 className="text-2xl font-semibold text-slate-900">
                    {MODE_CONFIGS.find((m) => m.key === selectedMode)?.label || 'Drive'}
                    {fallbackMode && (
                      <span className="ml-2 text-xs font-normal text-slate-400">(driving route shown)</span>
                    )}
                  </h2>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={handleShare} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200" aria-label="Share route">
                      <img src={shareIcon} alt="Share" className="h-5 w-5" />
                    </button>
                    <button type="button" onClick={() => setPanelOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200" aria-label="Close">
                      <img src={closeIcon} alt="Close" className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Vehicle selector row */}
                <div className="mt-12  flex flex-wrap items-center gap-56">
                  {MODE_CONFIGS.map((mode) => {
                    const active = mode.key === selectedMode;
                    const timeLabel = active
                      ? (selectedRoute?.duration || '--')
                      : modeMinutesCache.current[mode.key]
                        ? formatCompactDuration(modeMinutesCache.current[mode.key])
                        : estimateModeDuration(drivingMinutesRef.current || baseModeMinutes, mode.multiplier);
                    return (
                      <button
                        key={mode.key}
                        type="button"
                        onClick={() => {
                          setRoutes([]);
                          setFallbackMode(false);
                          setSelectedMode(mode.key);
                        }}
                        className="flex flex-col items-center gap-1 bg-transparent border-none outline-none cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <img src={mode.icon} alt={mode.label} className="h-6 w-5 object-contain" />
                          <span className="text-medium font-medium text-slate-700 whitespace-nowrap">{timeLabel}</span>
                        </div>
                        {/* thin blue underline on active */}
                        <div style={{ height: '3.4px', width: '200px',marginTop: '36px',borderRadius: '2px', background: active ? '#1A73E8' : 'transparent' }} />
                      </button>
                    );
                  })}
                </div>

                {/* black line below entire selector row */}
                <div style={{ height: '1.5px', background: '#000', marginTop: '1px', marginBottom: '32px', borderRadius: '1px' }} />
              </div>

              <div className="grid gap-4 px-5 py-5 sm:px-16">
                {routes.length > 0 && selectedRoute && (
                  <div className="pt-1">
                    {/* Line 2: dynamic route description */}
                    <div className="mt-4 text-medium text-slate-600">
                      {(() => {
                        const full = describeRoute(selectedRoute, selectedIdx, routes);
                        const viaIdx = full.indexOf(' · via ');
                        const firstLine = viaIdx !== -1 ? full.slice(0, viaIdx) : full;
                        const secondLine = viaIdx !== -1 ? full.slice(viaIdx + 3) : '';
                        return (
                          <>
                            <p>{firstLine}</p>
                            {secondLine && <p className="text-slate-500">{secondLine}</p>}
                          </>
                        );
                      })()}
                      {loadingRoutes && <span className="text-slate-400 text-xs">Updating...</span>}
                    </div>

                    {/* Line 3: toll + petrol */}
                    {(() => {
                      const { petrol } = buildRouteDescription(selectedRoute, selectedIdx, routes);
                      return (
  <p className="mt-4 text-sm text-slate-500 flex items-center gap-24">
    {/* Left side: icon + label */}
    <span className="flex items-center gap-2">
      <img src={coins} alt="Tolls icon" className="w-6 h-6 opacity-70" />
      <span>Tolls</span>
    </span>

    {/* Right side: petrol saving */}
    {petrol > 0 && <span>Saves ~{petrol}% petrol</span>}
  </p>

                      );
                    })()}

                    {/* Line 4: four action buttons */}
                    <div className="mt-12 flex flex-wrap items-center gap-72 ">
                      <button type="button" onClick={handleStart} className="rounded-xl bg-[#1A73E8] px-12 py-4 text-medium font-semibold text-white hover:bg-[#165fbe]">Start</button>
                      <button type="button" onClick={handleAddStop} className="rounded-xl bg-[#1A73E8] px-12 py-4 text-medium font-semibold text-white hover:bg-[#165fbe]">Add Stop</button>
                      <button type="button" onClick={handleShare} className="rounded-xl bg-[#1A73E8] px-12 py-4 text-medium font-semibold text-white hover:bg-[#165fbe]">Share</button>
                      <button type="button" onClick={handleSave} className="rounded-xl bg-[#1A73E8] px-12 py-4 text-medium font-semibold text-white hover:bg-[#165fbe]">Save</button>
                    </div>
                  </div>
                )}

              </div>
            </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          background: '#fff', borderRadius: '12px', padding: '20px 32px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)', zIndex: 10, color: '#e53e3e', fontWeight: 600,
        }}>
          {error}
        </div>
      )}

      {/* Location panel - inside map area, top right */}
      {!isStartPage && !addStopOpen && (
        <div
          className="p-6 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg"
          style={{ position: 'absolute', top:'-70px', right: '64px', width: '880px', minHeight: '150px', zIndex: 50 }}
        >
          <div className="flex items-center gap-3 pb-4">
            <img src={swapped ? redPinIcon : blueLocationIcon} alt="Origin" className="w-5 h-5 shrink-0" />
            <LocationInput
              placeholder="Your location"
              initialValue={pendingOriginLabel || ''}
              onSelect={onOriginSelect}
              showGps
              gpsDisplayValue="Your Location"
              onGpsSelect={() => {
                if (!navigator.geolocation) return;
                if (navWatchIdRef.current != null) {
                  navigator.geolocation.clearWatch(navWatchIdRef.current);
                  navWatchIdRef.current = null;
                }
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    userLocationRef.current = loc;
                    applyOrigin(loc, 'Your location', true);
                  },
                  () => {},
                  { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
                );
              }}
            />
          </div>
          <div className="flex items-center gap-3 py-2">
            <img src={threeDots} alt="Separator" className="w-7 h-7" />
            <hr style={{ width: '90%', border: 'none', borderTop: '3px solid #000' }} />
          </div>
          <div className="flex items-center gap-3 pt-4">
            <img src={swapped ? blueLocationIcon : redPinIcon} alt="Destination" className="w-5 h-5 shrink-0" />
            <LocationInput
              placeholder="Choose destination"
              initialValue={destination}
              onSelect={onDestSelect}
            />
          </div>
          <div className="absolute right-4 top-1/3 z-10" onClick={handleSwap} style={{ cursor: 'pointer' }}>
            <img src={upDown} alt="Swap" className="w-6 h-12 object-contain opacity-90" />
          </div>
          <div className="absolute top-3 right-4">
            <img src={threeDots} alt="Menu" className="w-7 h-7" />
          </div>
        </div>
      )}
    </div>
  );
};

export default Direction;
