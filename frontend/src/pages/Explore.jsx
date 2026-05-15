import { useEffect, useRef, useCallback } from 'react';
import middle from '../assets/middle.png';
import exploreIcon from '../assets/explore.png';
import userIcon from '../assets/userIcon.png';
import directionIcon from '../assets/directionIcon.png';
import { usePageTitle } from '../contexts/PageTitleContext';
import { ensureMapsScript } from '../utils/helpers';

const SIGIRIYA = { lat: 7.9570, lng: 80.7603 };

const Explore = () => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  const { setShowSearchBar, setOnNavigate } = usePageTitle();

  const handleNavigate = useCallback((place) => {
    if (!mapInstanceRef.current || !place.geometry?.location) return;
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
    center: SIGIRIYA,
    zoom: 13,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    zoomControl: true,
    rotateControl: false,
    gestureHandling: 'greedy',
    styles: [
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#a2daf2' }] },
      { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#d0f0c0' }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
      { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#9be79b' }] },
      { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#6abf69' }] },
    ],
  });
  markerRef.current = new window.google.maps.Marker({
    position: SIGIRIYA,
    map: mapInstanceRef.current,
    title: 'Sigiriya, Sri Lanka',
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
<div style={{ marginBottom: '80px', marginLeft: '60px', marginRight: '60px', marginTop: 0 }}>
        <div className="relative" style={{ width: '100%' }}>
          <div
            ref={mapRef}
            className="w-full block shadow-lg"
            style={{ height: '620px', margin: 0, padding: 0, boxShadow: '0 4px 24px rgba(0,0,0,0.15)', overflow: 'hidden', borderRadius: '15px' }}
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
