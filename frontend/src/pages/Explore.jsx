import { useEffect, useRef, useCallback, useState } from 'react';
import firstMap from '../assets/firstMap.png';
import middle from '../assets/middle.png';
import exploreIcon from '../assets/explore.png';
import userIcon from '../assets/userIcon.png';
import directionIcon from '../assets/directionIcon.png';
import { usePageTitle } from '../contexts/PageTitleContext';
import { ensureMapsScript } from '../utils/helpers';

const SRI_LANKA = { lat: 7.8731, lng: 80.7718 };

const Explore = () => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const { setShowSearchBar, setOnNavigate } = usePageTitle();

  const handleNavigate = useCallback((place) => {
    if (!mapInstanceRef.current || !place.geometry?.location) return;
    setMapReady(true);
    mapInstanceRef.current.panTo(place.geometry.location);
    mapInstanceRef.current.setZoom(13);
    if (markerRef.current) markerRef.current.setMap(null);
    markerRef.current = new window.google.maps.Marker({
      position: place.geometry.location,
      map: mapInstanceRef.current,
      title: place.formatted_address,
    });
  }, []);

  useEffect(() => {
    setShowSearchBar(true);
    setOnNavigate(handleNavigate);

const initMap = () => {
  mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
    center: SRI_LANKA,
    zoom: 7,
    restriction: {
      latLngBounds: { north: 10.0, south: 5.7, east: 82.1, west: 79.4 },
      strictBounds: true,
    },
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    zoomControl: false,
    rotateControl: false,
    gestureHandling: 'none',
    scrollwheel: false,
    styles: [
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#a2daf2' }] },
      { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#d0f0c0' }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
      { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#9be79b' }] },
      { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#6abf69' }] },
    ],
  });
};


    ensureMapsScript(initMap);

    return () => {
      setShowSearchBar(false);
      setOnNavigate(null);
    };
  }, []);

  return (
    <div className="relative w-full h-full py-12" style={{ minHeight: '700px' }}>
      {/* Background image */}
      <div className="absolute inset-0 z-0 opacity-40">
        <img
          src={middle}
          alt="Ocean background"
          className="w-full h-full object-cover scale-x-[1.7]"
        />
      </div>

      {/* Map area */}
<div style={{ marginBottom: '80px', marginLeft: 0, marginRight: 0, marginTop: 0 }}>
        <div className="relative" style={{ width: '100%' }}>
          {/* firstMap.png shown by default, hidden once a location is searched */}
          <img
            src={firstMap}
            alt="Map"
            style={{
              width: '100%',
              height: '1500px',
              borderRadius: '15px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
              display: mapReady ? 'none' : 'block',
            }}
          />
         {/* Live Google Map, hidden until a location is searched */}
{/* Live Google Map, hidden until a location is searched */}
<div
  ref={mapRef}
  className="w-full block shadow-lg"
  style={{ height: '620px', margin: 0, padding: 0, boxShadow: '0 4px 24px rgba(0,0,0,0.15)', overflow: 'hidden', display: mapReady ? 'block' : 'none' }}
></div>


          <img
            src={directionIcon}
            alt="Direction"
            style={{ position: 'absolute', bottom: '20px', right: '50px', width: '70px', cursor: 'pointer', zIndex: 10 }}
          />
        </div>
      </div>

      {/* Icons row */}
      <div
        className="relative z-10 flex justify-center items-center gap-[30rem]"
        style={{ marginTop: '8px', marginBottom: '8px', paddingLeft: '16px', paddingRight: '16px' }}
      >
        <img src={exploreIcon} alt="Explore" style={{ width: '140px', cursor: 'pointer' }} />
        <img src={userIcon}    alt="User"    style={{ width: '140px', cursor: 'pointer' }} />
      </div>
    </div>
  );
};

export default Explore;
