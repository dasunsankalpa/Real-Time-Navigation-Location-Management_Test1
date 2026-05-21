import { useEffect, useRef, useCallback, useState } from 'react';
import middle from '../assets/middle.png';
import exploreIcon from '../assets/explore.png';
import explore2 from '../assets/explore2.png';
import userIcon from '../assets/userIcon.png';
import user from '../assets/user.png';
import directionIcon from '../assets/directionIcon.png';
import directionImg from '../assets/direction.png';
import { usePageTitle } from '../contexts/PageTitleContext';
import { ensureMapsScript } from '../utils/helpers';

const USER_LOCATION = { lat: 7.8731, lng: 80.7718 }; // Sri Lanka center

const Explore = () => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const userMarkerRef = useRef(null);

  const { setShowSearchBar, setOnNavigate, hasSearched, setHasSearched, searchedPlace, setActivePage, setUserLocation } = usePageTitle();
  const [localSearched, setLocalSearched] = useState(false);
  const searched = hasSearched || localSearched;
  const [placePhotos, setPlacePhotos] = useState([]);
  const [nearbyHotels, setNearbyHotels] = useState([]);
  const [showUserPopup, setShowUserPopup] = useState(false);
  const [selectedSavedPlaceTab, setSelectedSavedPlaceTab] = useState('home');
  const [hoveredSavedPlaceTab, setHoveredSavedPlaceTab] = useState(null);
  const userDisplayName = (typeof window !== 'undefined' && (window.localStorage.getItem('userName') || window.localStorage.getItem('displayName'))) || 'nethmi';

  const handleNavigate = useCallback((place) => {
    if (!mapInstanceRef.current || !place.geometry?.location) return;
    mapInstanceRef.current.panTo(place.geometry.location);
    mapInstanceRef.current.setZoom(13);
    if (markerRef.current) markerRef.current.setMap(null);
    markerRef.current = new window.google.maps.Marker({
      position: place.geometry.location,
      map: mapInstanceRef.current,
      title: /^[23456789CFGHJMPQRVWX]{4}\+/.test(place.formatted_address || '') ? place.name : (place.formatted_address || place.name),
    });
    setLocalSearched(true);
    setHasSearched(true);

    const service = new window.google.maps.places.PlacesService(mapInstanceRef.current);

    // Fetch photos from most popular places near searched location
    service.nearbySearch({
      location: place.geometry.location,
      radius: 10000,
      type: 'tourist_attraction',
    }, (results, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && results.length > 0) {
        const sorted = results
          .filter(r => r.photos && r.photos.length > 0 && r.rating)
          .sort((a, b) => (b.rating * (b.user_ratings_total || 0)) - (a.rating * (a.user_ratings_total || 0)));
        const urls = sorted.slice(0, 3).map(r => r.photos[0].getUrl({ maxWidth: 1600, maxHeight: 1200 }));
        setPlacePhotos(urls.length > 0 ? urls : []);
      } else if (place.photos && place.photos.length > 0) {
        const sorted = [...place.photos].sort((a, b) => {
          const aRatio = a.width / a.height;
          const bRatio = b.width / b.height;
          return Math.abs(aRatio - 1.5) - Math.abs(bRatio - 1.5);
        });
        setPlacePhotos(sorted.slice(0, 3).map(p => p.getUrl({ maxWidth: 1600, maxHeight: 1200 })));
      } else {
        setPlacePhotos([]);
      }
    });

    // Fetch nearby hotels
    service.nearbySearch({
      location: place.geometry.location,
      radius: 5000,
      keyword: 'hotel',
      type: 'lodging',
    }, (results, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK) {
        const filtered = results
          .filter(r => r.rating && r.name.toLowerCase().includes('hotel'))
          .sort((a, b) => b.rating - a.rating)
          .slice(0, 10);

        const hotelPromises = filtered.map(r => new Promise(resolve => {
          service.getDetails({ placeId: r.place_id, fields: ['name', 'rating', 'user_ratings_total', 'photos', 'geometry', 'price_level'] }, (detail, s) => {
            if (s === window.google.maps.places.PlacesServiceStatus.OK && detail) {
              const hotelLoc = detail.geometry?.location;
              const searchLoc = place.geometry.location;
              let distanceMiles = null;
              if (hotelLoc && searchLoc) {
                const R = 3958.8;
                const lat1 = searchLoc.lat() * Math.PI / 180;
                const lat2 = hotelLoc.lat() * Math.PI / 180;
                const dLat = (hotelLoc.lat() - searchLoc.lat()) * Math.PI / 180;
                const dLng = (hotelLoc.lng() - searchLoc.lng()) * Math.PI / 180;
                const a = Math.sin(dLat/2)**2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng/2)**2;
                distanceMiles = (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(1);
              }
              const priceLKR = { 0: 'LKR 1,000+', 1: 'LKR 2,000+', 2: 'LKR 5,000+', 3: 'LKR 10,000+', 4: 'LKR 20,000+' };
              resolve({
                name: detail.name,
                rating: detail.rating || r.rating,
                totalRatings: detail.user_ratings_total || 0,
                photo: detail.photos && detail.photos.length > 0 ? detail.photos[0].getUrl({ maxWidth: 600, maxHeight: 400 }) : null,
                distanceMiles,
                price: detail.price_level != null ? priceLKR[detail.price_level] : 'LKR 5,000+',
              });
            } else {
              resolve({
                name: r.name,
                rating: r.rating,
                totalRatings: r.user_ratings_total || 0,
                photo: r.photos ? r.photos[0].getUrl({ maxWidth: 600, maxHeight: 400 }) : null,
                distanceMiles: null,
                price: 'LKR 5,000+',
              });
            }
          });
        }));

        Promise.all(hotelPromises).then(hotels => setNearbyHotels(hotels.filter(h => h.photo)));
      } else {
        setNearbyHotels([]);
      }
    });
  }, [setHasSearched]);

  useEffect(() => {
    setShowSearchBar(true);
    setOnNavigate(handleNavigate);

const initMap = (center, zoom) => {
  mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
    center,
    zoom,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    zoomControl: true,
    rotateControl: false,
    gestureHandling: 'cooperative',
    styles: [
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#a2daf2' }] },
      { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#d0f0c0' }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
      { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#9be79b' }] },
      { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#6abf69' }] },
    ],
  });
};

const placeUserMarker = (coords) => {
  if (userMarkerRef.current) userMarkerRef.current.setMap(null);
  userMarkerRef.current = new window.google.maps.Marker({
    position: coords,
    map: mapInstanceRef.current,
    title: 'Your Location',
    icon: {
      path: window.google.maps.SymbolPath.CIRCLE,
      scale: 10,
      fillColor: '#4285F4',
      fillOpacity: 1,
      strokeColor: '#fff',
      strokeWeight: 2,
    },
  });
};

ensureMapsScript(() => {
  initMap(USER_LOCATION, 8);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(pos);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setCenter(pos);
          mapInstanceRef.current.setZoom(14);
        }
        placeUserMarker(pos);
      },
      (error) => {
        console.error("Error getting user location:", error);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }
});


    return () => {
      setShowSearchBar(false);
      setOnNavigate(null);
    };
  }, []);

  useEffect(() => {
    if (!searchedPlace?.geometry?.location || !mapInstanceRef.current) return;
    handleNavigate(searchedPlace);
  }, [searchedPlace, handleNavigate]);

  return (
    <div className="relative w-full h-full py-12" style={{ minHeight: '700px' }}>
      {/* Background image */}
      <div className="absolute inset-0 z-0 opacity-20">
        <img
          src={middle}
          alt="Ocean background"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Map area */}
      <div style={{ marginBottom: searched ? '0' : '80px', marginLeft: '60px', marginRight: '60px', marginTop: showUserPopup ? '-80px' : 0 }}>
        <div className="relative" style={{ width: '100%' }}>
          <div
            ref={mapRef}
            className="w-full block shadow-lg"
            style={{ height: '750px', margin: 0, padding: 0, boxShadow: '0 4px 24px rgba(0,0,0,0.15)', overflow: 'hidden', borderRadius: '15px', position: 'relative', zIndex: 5 }}
          ></div>
          <img
            src={directionIcon}
            alt="Direction"
            onClick={() => setActivePage('directionOne')}
            style={{ position: 'absolute', bottom: '20px', right: '50px', width: '70px', cursor: 'pointer', zIndex: 40 }}
          />
        </div>
      </div>

      {/* explore2 image - shown directly under map when searched, else show icon buttons */}
      {searched ? (
        <div style={{
          position: 'relative',
          marginLeft: '60px',
          marginRight: '60px',
          marginTop: '16px',
          borderRadius: '12px',
          overflow: 'visible',
          height: 'auto',
          minHeight: '700px',
          background: '#D7EEFD',
        }}>
          <img
            src={explore2}
            alt="Explore"
            style={{
              position: 'absolute',
              width: '1443.93px',
              height: '844.18px',
              top: '0px',
              left: '0px',
              transform: 'rotate(0.09deg)',
              objectFit: 'cover',
              objectPosition: 'top',
              display: 'block',
              zIndex: 1,
            }}
          />
          {/* Rectangle box top left on explore2 image */}
          <div style={{
            position: 'relative',
            top: '0px',
            left: '0px',
            width: '100%',
            height: 'auto',
            minHeight: '500px',
            background: '#D7EEFD',
            zIndex: 2,
            padding: '20px',
          }}>
            {searchedPlace && (
              <>
                <span style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 700,
                  fontSize: '30px',
                  lineHeight: '121%',
                  letterSpacing: '0%',
                  color: '#000000',
                  display: 'block',
                  marginBottom: '100px',
                }}>
                  {searchedPlace.displayName || searchedPlace.formatted_address?.split(',')[0]}
                </span>
                <div style={{ display: 'flex', gap: '20%',marginTop: '60px' }}>
                  {[{ label: 'Direction', icon: directionImg }, { label: 'Start', icon: null }, { label: 'Save', icon: null }, { label: 'Share', icon: null }].map(({ label, icon }) => (
                    <button
                      key={label}
                      onClick={() => label === 'Direction' && setActivePage('direction')}
                      style={{
                        padding: '14px 28px',
                        borderRadius: '6px',
                        border: 'none',
                        background: '#1A73E8',
                        color: '#fff',
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 600,
                        fontSize: '14px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '30px',
                        ...(label === 'Direction' && { paddingLeft: '39px', paddingRight: '39px' }),
                      }}
                    >
                      {icon && <img src={icon} alt={label} style={{ width: '23px', height: '23px', objectFit: 'contain', marginLeft: '-15px' }} />}
                      {label}
                    </button>
                  ))}
                </div>
                {/* 3 photos layout */}
                {placePhotos.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '130px', height: '620px', width: '100%' }}>
                    {/* Large photo on the left */}
                    <img
                      src={placePhotos[0]}
                      alt="Place 1"
                      style={{ width: '60%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
                    />
                    {/* 2 smaller photos stacked on the right */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '40%' }}>
                      {placePhotos[1] && (
                        <img
                          src={placePhotos[1]}
                          alt="Place 2"
                          style={{ width: '100%', height: '50%', objectFit: 'cover', borderRadius: '8px' }}
                        />
                      )}
                      {placePhotos[2] && (
                        <img
                          src={placePhotos[2]}
                          alt="Place 3"
                          style={{ width: '100%', height: '50%', objectFit: 'cover', borderRadius: '8px' }}
                        />
                      )}
                    </div>
                  </div>
                )}
                {/* Hotel Nearby text */}
                {nearbyHotels.length > 0 && (
                  <div style={{ marginTop: '60px', textAlign: 'left' }}>
                    <span style={{
                      fontFamily: 'Inter, sans-serif',
                      fontWeight: 400,
                      fontStyle: 'normal',
                      fontSize: '24px',
                      lineHeight: '100%',
                      letterSpacing: '0%',
                      color: '#000000',
                    }}>
                      Hotel Nearby
                    </span>
                    {/* Hotels horizontal list */}
                    {nearbyHotels.length > 0 && (
                      <div className="hide-scrollbar" style={{ display: 'flex', gap: '16px', marginTop: '20px', overflowX: 'auto', paddingBottom: '12px', scrollbarWidth: 'none', msOverflowStyle: 'none', width: '100%' }}>
                        {nearbyHotels.map((hotel, idx) => (
                          <div key={idx} style={{
                            minWidth: '300px',
                            background: '#fff',
                            borderRadius: '10px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                            overflow: 'hidden',
                            flexShrink: 0,
                          }}>
                            {hotel.photo && (
                              <div style={{ position: 'relative' }}>
                                <img
                                  src={hotel.photo}
                                  alt={hotel.name}
                                  style={{ width: '100%', height: '200px', objectFit: 'cover' }}
                                />
                                <a
                                  href={`https://www.booking.com/search.html?ss=${encodeURIComponent(hotel.name)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    position: 'absolute',
                                    bottom: '10px',
                                    right: '10px',
                                    background: '#fff',
                                    color: '#000',
                                    fontFamily: 'Inter, sans-serif',
                                    fontWeight: 600,
                                    fontSize: '12px',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                                    textDecoration: 'none',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {hotel.price}
                                </a>
                              </div>
                            )}
                            <div style={{ padding: '10px', position: 'relative' }}>
                              <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '14px', color: '#000', marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {hotel.name}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ color: '#F5A623', fontSize: '14px' }}>{'★'.repeat(Math.round(hotel.rating))}</span>
                                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#555' }}>{hotel.rating.toFixed(1)}</span>
                                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#999' }}>({hotel.totalRatings})</span>
                              </div>
                              {hotel.distanceMiles && (
                                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#1A73E8', marginTop: '30px' }}>
                                  {hotel.distanceMiles} miles away
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div
          className="relative z-10 flex justify-center items-center gap-[30rem]"
          style={{ marginTop: '120px', marginBottom: '8px', paddingLeft: '16px', paddingRight: '16px', zIndex: 40 }}
        >
          <img
            src={exploreIcon}
            alt="Explore"
            style={{ width: '140px', cursor: 'pointer', position: 'relative', zIndex: 40 }}
            onClick={() => setShowUserPopup(false)}
          />
          {showUserPopup && (
            <div
              style={{
                position: 'absolute',
                left: '60px',
                right: '60px',
                top: '-750px',
                height: '890px',
                borderRadius: '12px',
                background: '#D7EEFD',
                boxShadow: '0 4px 18px rgba(26,115,232,0.12)',
                padding: '18px 22px',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 20,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px',marginLeft: '25px' }}>
                <div
                  style={{
                    width: '70px',
                    height: '70px',
                    borderRadius: '999px',
                    background: '#E5E7EB',
                    overflow: 'hidden',
                    flexShrink: 0,
                    display: 'flex',              // enable flexbox
                    justifyContent: 'center',     // center horizontally
                    alignItems: 'center', 
                  }}
                >
                  <img src={user} alt="User" style={{ width: '40%', height: '40%', objectFit: 'cover', }} />
                </div>
                <div style={{ lineHeight: 1.05 }}>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '20px', fontWeight: 700, color: '#1F2937' }}>
                    You
                  </div>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px', fontWeight: 500, color: '#374151', marginTop: '4px' }}>
                    {userDisplayName}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: '72px'}}>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '16px', fontWeight: 500, color: '#1F2937', marginBottom: '18px',marginLeft: '65px' }}>
                  Save Places
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'stretch',
                    justifyContent: 'space-between',
                    gap: '10px',
                    background: '#8CC9F3',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    marginLeft: '120px',
                    marginRight: '120px',
                    boxShadow: '0 2px 6px rgba(26,115,232,0.10) inset',
                  }}
                >
                  {[
                    { key: 'home', label: 'home', icon: true },
                    { key: 'work', label: 'work', icon: false },
                    { key: 'favorite', label: 'Favorite', icon: false },
                  ].map((tab) => {
                    const selected = selectedSavedPlaceTab === tab.key;
                    const hovered = hoveredSavedPlaceTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setSelectedSavedPlaceTab(tab.key)}
                        onMouseEnter={() => setHoveredSavedPlaceTab(tab.key)}
                        onMouseLeave={() => setHoveredSavedPlaceTab(null)}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '10px',
                          minHeight: '40px',
                          border: 'none',
                          borderRadius: '4px',
                          background: selected ? 'rgba(31,41,55,0.10)' : hovered ? 'rgba(160,219,255,0.55)' : 'transparent',
                          boxShadow: selected ? 'inset 0 0 0 1px rgba(31,41,55,0.12)' : 'none',
                          color: '#1F2937',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease, box-shadow 0.15s ease',
                        }}
                      >
                        {tab.icon && (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M3 10.5 12 3l9 7.5" />
                            <path d="M5 10v10h14V10" />
                            <path d="M9 20v-7h6v7" />
                          </svg>
                        )}
                        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '15px', fontWeight: selected ? 700 : 500, color: selected || hovered ? '#111827' : '#1F2937' }}>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ marginTop: '40px',marginLeft: '65px', fontFamily: 'Inter, sans-serif', fontSize: '16px', fontWeight: 500, color: '#1F2937' }}>
                  Your Recent Places
                </div>
              </div>
            </div>
          )}
          <img
            src={userIcon}
            alt="User"
            style={{ width: '140px', cursor: 'pointer', position: 'relative', zIndex: 40 }}
            onClick={() => setShowUserPopup((value) => !value)}
          />
        </div>
      )}
    </div>
  );
};
//new
export default Explore;
