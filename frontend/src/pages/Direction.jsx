import { useEffect, useRef, useState, useCallback } from 'react';
import middle from '../assets/middle.png';
import bikeIcon from '../assets/bikeIcon.png';
import manIcon from '../assets/manIcon.png';
import busIcon from '../assets/busIcon.png';
import coins from '../assets/coins.png';
import shareIcon from '../assets/shareIcon.png';
import carIcon from '../assets/carIcon.png';
import blueLocationIcon from '../assets/directionCircle.png';
import redPinIcon from '../assets/locationRed.png';
import threeDots from '../assets/3dots.png';
import upDown from '../assets/upDown.png';
import closeIcon from '../assets/closeIcon.png';
import { usePageTitle } from '../contexts/PageTitleContext';
import { ensureMapsScript } from '../utils/helpers';
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

const Direction = () => {
  const { searchedPlace, userLocation, setActivePage } = usePageTitle();
  const destination = searchedPlace?.displayName || searchedPlace?.formatted_address?.split(',')[0] || 'destination';

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const renderersRef = useRef([]);
  const clickPathsRef = useRef([]);
  const routeRequestIdRef = useRef(0);
  const originMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);

  const [routes, setRoutes] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [selectedMode, setSelectedMode] = useState('drive');
  const [error, setError] = useState(null);
  const [swapped, setSwapped] = useState(false);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [originLabel, setOriginLabel] = useState('');
  const [destPlace, setDestPlace] = useState(searchedPlace);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const userLocationRef = useRef(null);
  // Cache actual API minutes per mode so inactive buttons show accurate estimates
  const modeMinutesCache = useRef({});
  const activeRoutePairRef = useRef({ origin: null, destination: null });

  const directionsResultRef = useRef(null);
  const selectRouteRef = useRef(null);
  const originChosenRef = useRef(false); // true only after user explicitly picks a start

  const selectedRoute = routes[selectedIdx] || routes[0] || null;
  const selectedRouteMinutes = parseDurationToMinutes(selectedRoute?.duration);
  // Always base estimates on the driving route minutes, not the current mode
  const drivingMinutesRef = useRef(0);

  const tooltipRef = useRef(null);
  const routeLabelsRef = useRef([]);
  const RouteLabelClassRef = useRef(null);

  const getRouteLabelClass = () => {
    if (RouteLabelClassRef.current) return RouteLabelClassRef.current;
    RouteLabelClassRef.current = class RouteLabel extends window.google.maps.OverlayView {
      constructor(pos, html) {
        super();
        this.pos = pos;
        this.html = html;
        this.div = null;
      }
      onAdd() {
        this.div = document.createElement('div');
        this.div.style.cssText = 'position:absolute;background:#fff;border-radius:8px;padding:5px 9px;font-size:12px;font-family:Inter,sans-serif;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.18);pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:2px;transform:translate(-50%,-50%);';
        this.div.innerHTML = this.html;
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

  const createRouteLabel = (map, position, content) => {
    const LabelClass = getRouteLabelClass();
    const label = new LabelClass(position, content);
    label.setMap(map);
    return label;
  };

  const hideTooltip = () => {};

  const clearRouteOverlays = () => {
    renderersRef.current.forEach((renderer) => renderer.setMap(null));
    clickPathsRef.current.forEach((path) => path.setMap(null));
    routeLabelsRef.current.forEach((label) => label.setMap(null));
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
        strokeWeight: 20,
        zIndex: 20,
        clickable: true,
      });
      clickPath.addListener('click', () => selectRouteRef.current(i));

      // Permanent label at route midpoint
      const path = route.overview_path;
      const midPoint = path[Math.floor(path.length / 2)];
      const leg = result.routes[i]?.legs?.[0];
      const duration = leg?.duration_in_traffic?.text || leg?.duration?.text || '--';
      const distance = leg?.distance?.text || '--';
      const modeConfig = MODE_CONFIGS.find(m => m.key === selectedMode) || MODE_CONFIGS[0];
      const labelContent = `
        <div style="display:flex;align-items:center;gap:4px">
          <img src="${modeConfig.icon}" style="width:16px;height:16px;object-fit:contain" />
          <span style="font-weight:600;color:#1a1a1a">${duration}</span>
        </div>
        <span style="font-size:11px;color:#6B7280">${distance}</span>`;
      const label = createRouteLabel(mapInstanceRef.current, midPoint, labelContent);
      routeLabelsRef.current.push(label);

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

  useEffect(() => {
    ensureMapsScript(() => {
      const destLoc = (destPlace || searchedPlace)?.geometry?.location;
      const initialCenter = destLoc ? { lat: destLoc.lat(), lng: destLoc.lng() } : { lat: 7.8731, lng: 80.7718 };

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
          () => {}
        );
      }
    });
    return () => {
      routeRequestIdRef.current += 1;
      clearRouteOverlays();
    };
  }, []);

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
      setActivePage('eta');
      setActionMessage('Starting navigation.');
    }
  };

  const handleAddStop = () => {
    if (setActivePage) {
      setActivePage('addStop');
      setActionMessage('Opening stop planner.');
    }
  };

  const baseModeMinutes = selectedMode === 'drive'
    ? (selectedRouteMinutes || drivingMinutesRef.current || 215)
    : (drivingMinutesRef.current || selectedRouteMinutes || 215);

  return (
    <div className="relative w-full bg-[#edf7ff]" style={{ minHeight: '500px' }}>
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
        <img src={middle} alt="Ocean background" className="w-full h-full object-cover scale-x-[1.7]" />
      </div>

      <div className="relative z-10 w-full">
        <div className="relative h-[700px] w-full">
          <div ref={mapRef} className="h-full w-full shadow-[0_18px_50px_rgba(18,46,99,0.12)]" />
        </div>


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
                  {/* Line 1: time + distance */}
              <p style={{ fontSize: '17px', fontWeight: 600, color: '#1A1A1A' }}>
                <span style={{ color: '#1A73E8' }}>{selectedRoute.duration}</span> ({selectedRoute.distance})
              </p>


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
      <div
        className="p-6 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg"
        style={{ position: 'absolute', top:'-70px', right: '64px', width: '880px', minHeight: '150px', zIndex: 50 }}
      >
        <div className="flex items-center gap-3 pb-4">
          <img src={swapped ? redPinIcon : blueLocationIcon} alt="Origin" className="w-5 h-5 shrink-0" />
          <LocationInput
            placeholder="Choose starting point, or click on the map"
            initialValue=''
            onSelect={onOriginSelect}
            showGps
            gpsDisplayValue="Your Location"
            onGpsSelect={() => {
              if (userLocationRef.current) applyOrigin(userLocationRef.current, 'Your location', true);
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
    </div>
  );
};

export default Direction;
