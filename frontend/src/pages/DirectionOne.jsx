import { useState, useRef, useEffect } from 'react';
import middle from '../assets/middle.png';
import bikeIcon from '../assets/bikeIcon.png';
import busIcon from '../assets/busIcon.png';
import carIcon from '../assets/carIcon.png';
import clockIcon from '../assets/clockIcon.png';
import directionCircle from '../assets/directionCircle.png';
import locationRed from '../assets/locationRed.png';
import manIcon from '../assets/manIcon.png';
import upDown from '../assets/upDown.png';
import { useLocationSearch } from '../utils/useLocationSearch';
import { usePageTitle } from '../contexts/PageTitleContext';
import { ensureMapsScript } from '../utils/helpers';

const recentPlaces = [
  'Galgamuwa',
  'Kurunegala',
  'Down Town Depot Mahawa',
  'Anuradhapura',
  'Polonnaruwa',
  'Jaffna',
];

const LocationRow = ({ icon, search, placeholder, vehicleIcon, onSearch }) => {
  return (
    <div ref={search.containerRef} className="relative flex items-center">
      <img src={icon} alt={placeholder} style={{ width: '48px', height: '48px', marginRight: '10px' }} />
      <div
        className="bg-gradient-to-r from-[#FFFFFF] to-[#A0DBFF] shadow text-full text-center font-bold relative"
        style={{ borderRadius: '8px', padding: '16px 24px', width: '700px', display: 'flex', alignItems: 'center' }}
      >
        <input
          type="text"
          value={search.query}
          onChange={search.handleChange}
          onKeyDown={search.handleKeyDown}
          placeholder={placeholder}
          className="border-0 bg-transparent text-center font-bold text-gray-800 outline-none"
          style={{ caretColor: '#1A73E8', flex: 1 }}
          onFocus={e => e.target.style.setProperty('--placeholder-opacity', '0')}
          onBlur={e => e.target.style.setProperty('--placeholder-opacity', '0.45')}
        />
        {vehicleIcon && (
          <svg
            onClick={onSearch}
            width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke="#1A73E8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ flexShrink: 0, cursor: 'pointer' }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        )}
      </div>

      {search.suggestions.length > 0 && (
        <ul
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: '58px',
            width: '700px',
            background: '#fff',
            borderRadius: '10px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            zIndex: 9999,
            listStyle: 'none',
            margin: 0,
            padding: '4px 0',
            maxHeight: '220px',
            overflowY: 'auto',
          }}
        >
          {search.suggestions.map((place, idx) => (
            <li
              key={place.place_id}
              onMouseDown={() => search.confirmPlace(place.place_id, place.structured_formatting.main_text)}
              onMouseEnter={() => search.setActiveIdx(idx)}
              style={{
                padding: '9px 14px',
                cursor: 'pointer',
                fontSize: '13px',
                color: '#333',
                background: idx === search.activeIdx ? '#EFF6FF' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span style={{ color: '#6B7280', fontSize: '13px' }}>•</span>
              <span>
                <strong>{place.structured_formatting.main_text}</strong>
                {place.structured_formatting.secondary_text && (
                  <span style={{ color: '#6B7280', marginLeft: 4 }}>{place.structured_formatting.secondary_text}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const DirectionOne = () => {
  const { setActivePage, setSearchedPlace, setUserLocation, setPendingOriginLabel, setPendingVehicle } = usePageTitle();
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [swapped, setSwapped] = useState(false);
  const [searching, setSearching] = useState(false);
  const geocoderRef = useRef(null);
  const originSearch = useLocationSearch(() => {}, '');
  const destinationSearch = useLocationSearch(() => {}, '');

  useEffect(() => {
    ensureMapsScript(() => {
      geocoderRef.current = new window.google.maps.Geocoder();
    });
  }, []);

  const vehicleIconMap = { bus: busIcon, bike: bikeIcon, car: carIcon, man: manIcon };
  const bothFilled = originSearch.query.trim() && destinationSearch.query.trim();
  const activeVehicleIcon = bothFilled && selectedVehicle ? vehicleIconMap[selectedVehicle] : null;

  const handleSearch = () => {
    if (!bothFilled || !geocoderRef.current) return;
    setSearching(true);
    const geocoder = geocoderRef.current;
    const SL = { country: 'lk' };

    geocoder.geocode({ address: originSearch.query, componentRestrictions: SL }, (originResults, originStatus) => {
      geocoder.geocode({ address: destinationSearch.query, componentRestrictions: SL }, (destResults, destStatus) => {
        setSearching(false);
        if (originStatus === 'OK' && originResults[0]) {
          const loc = originResults[0].geometry.location;
          setUserLocation({ lat: loc.lat(), lng: loc.lng() });
          setPendingOriginLabel(originSearch.query);
        }
        if (destStatus === 'OK' && destResults[0]) {
          setSearchedPlace({ ...destResults[0], displayName: destinationSearch.query });
        }
        if (selectedVehicle) setPendingVehicle(selectedVehicle);
        setActivePage('direction');
      });
    });
  };

  const handleSwap = () => {
    const originValue = originSearch.query;
    const destinationValue = destinationSearch.query;

    originSearch.setQuery(destinationValue);
    destinationSearch.setQuery(originValue);
    originSearch.setActiveIdx(-1);
    destinationSearch.setActiveIdx(-1);
    setSwapped((prev) => !prev);
  };

  const vehicles = [
    { key: 'bus',  src: busIcon,  alt: 'Bus',  className: 'w-12 h-12' },
    { key: 'bike', src: bikeIcon, alt: 'Bike', className: 'w-12 h-12' },
    { key: 'car',  src: carIcon,  alt: 'Car',  className: 'w-12.3 h-9'  },
    { key: 'man',  src: manIcon,  alt: 'Walk', className: 'w-12 h-11.3' },
  ];

  return (
    <div className="relative w-full min-h-screen bg-[#e3f3fc] flex flex-col items-center">
      <style>{`
        input::placeholder { opacity: 1; transition: opacity 0.2s; }
        input:focus::placeholder { opacity: 0; }
      `}</style>
      {/* Background image */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
        <img 
          src={middle} 
          alt="Ocean background" 
          className="w-full h-full object-cover scale-x-[1.7]" 
        />
      </div>

      {/* Location Inputs - left aligned, adjust marginLeft/marginTop/gap values */}
      <div
        className="relative z-20 flex items-center"
        style={{ marginTop: '20px', marginLeft: '700px', gap: '12px' }}
      >
        {/* Two text box rows */}
        <div className="flex flex-col" style={{ gap: '20px' }}>
          <LocationRow
            icon={directionCircle}
            search={originSearch}
            placeholder="Your location"
          />
          <LocationRow
            icon={locationRed}
            search={destinationSearch}
            placeholder="Choose destination"
            vehicleIcon={activeVehicleIcon}
            onSearch={handleSearch}
          />
        </div>

        {/* Single upDown icon beside both boxes */}
        <img
          src={upDown}
          alt="Swap"
          onClick={handleSwap}
          style={{ width: '40px', marginLeft: '20px', cursor: 'pointer', marginRight: '720px' }}
        />
      </div>

      {/* Transport Icons */}
<div className="relative z-10 flex justify-center gap-32 mt-6 mb-10">
  {vehicles.map(({ key, src, alt, className }) => (
    <img
      key={key}
      src={src}
      alt={alt}
      className={className}
      onClick={() => setSelectedVehicle(key)}
      style={{
        cursor: 'pointer',
        borderRadius: '4px', // square with slightly rounded corners
        padding: '6px',
        transition: 'background 0.2s, box-shadow 0.2s',
        background: selectedVehicle === key ? 'rgba(0,0,0,0.1)' : 'transparent',
        boxShadow: selectedVehicle === key ? '0 0 0 1px #5d5d61' : 'none',
      }}
      onMouseEnter={(e) => {
        if (selectedVehicle !== key) {
          e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; // subtle hover square
        }
      }}
      onMouseLeave={(e) => {
        if (selectedVehicle !== key) {
          e.currentTarget.style.background = 'transparent';
        }
      }}
    />
  ))}
</div>

      {/* Recent Section */}
      <div className="relative z-10 w-full max-w-full mt-12 ">
        {/* Large container box */}
        <div className="bg-[#D7EEFD] rounded-lg px-4 py-6 shadow w-full">
          {/* Recent heading inside box */}
          <div className="text-xl font-bold text-gray-700 mb-12 pl-4">
            recent
          </div>

          {/* Recent places inside same box */}
          <div className="flex flex-col gap-7">
            {recentPlaces.map((place, idx) => (
              <div
                key={place}
                className="flex items-center bg-[#A2D4F2] rounded-lg px-4 py-5 shadow"
              >
                <img
                  src={clockIcon}
                  alt="Clock"
                  className="w-7 h-7 mr-3 opacity-80"
                />
                <span className="text-sm font-medium text-gray-800">{place}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
    );
};

export default DirectionOne;
