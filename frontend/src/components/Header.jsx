import React, { useState, useRef, useEffect } from 'react';
import { MapPin, Mic } from 'lucide-react';
import Logo from '../assets/Logo.png';
import { usePageTitle } from '../contexts/PageTitleContext';
import sriflag from '../assets/sriflag.jpg';
import { ensureMapsScript } from '../utils/helpers';

export default function Header() {
  const { title, showSearchBar, navigateToSearch } = usePageTitle();
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);

  useEffect(() => {
    if (!showSearchBar) return;
    ensureMapsScript(() => {
      if (!inputRef.current || autocompleteRef.current) return;
      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        fields: ['geometry', 'formatted_address', 'name', 'photos'],
      });
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();
        if (place?.geometry) navigateToSearch(place);
      });
    });
    return () => { autocompleteRef.current = null; };
  }, [showSearchBar]);
  return (
    <header className="relative z-10 bg-white/90 backdrop-blur-sm shadow-md py-1 h-28 overflow-visible" style={{ borderBottom: '1px solid #F5F7FA', transform: 'translateZ(0)', willChange: 'transform' }}>
      <div className="max-w-11xl mx-auto flex items-center justify-between h-full">
        {/* Left: logo + text close together */}
        <div className="flex items-center gap-1 h-full relative">
          <img src={Logo} alt="Sri Lanka Tourism Logo" className="h-40 w-auto drop-shadow-md absolute -top-1 left-0" style={{ zIndex: 2, transform: 'translateZ(0)' }} />
          <div className="flex flex-col items-center ml-24" style={{ marginTop: '20px' }}>
            <span className="font-bold leading-tight" style={{ fontSize: 17, color: '#122E63', fontFamily: "'Inter', sans-serif", fontWeight: 700, letterSpacing: '1px' }}>
                 Smart Virtual Tourist Guide
            </span>
            <div
              style={{
                background: '#fff',
                display: 'inline-block',
                padding: '0 8px',
                borderRadius: '6px',
                position: 'relative',
                boxSizing: 'border-box',
                marginTop: 0
              }}
            >
           <span
  className="font-bold leading-tight whitespace-nowrap"
  style={{
    fontSize: 'clamp(2rem, 2.6rem, 3rem)', // responsive with max size
    letterSpacing: '8px',
    fontFamily: "'Inter', sans-serif",
    display: 'inline-block',
    fontWeight: 700,
    backgroundImage: `url(${sriflag})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center 20px',
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    color: 'transparent',
    transform: 'translateZ(0)',
    willChange: 'transform',
  }}
>
  Sri Lanka
</span>
  
            </div>
          </div>
        </div>
        {/* Middle: title absolutely centered in header */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 1 }}>
          <h1 className="font-bold text-black text-3xl">{title}</h1>
        </div>
        {/* Right: Search Bar */}
        {showSearchBar ? (
          <div
            className="flex items-center gap-2 px-4 py-2"
            style={{
              background: 'linear-gradient(135deg, #ffffff 0%, #A0DBFF 100%)',
              borderRadius: '999px',
              width: '800px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              margin: '10px 30px',
              border: '0px solid rgb(205, 200, 200)'
            }}
          >
            <MapPin size={18} color="#000000" strokeWidth={2} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search Here"
              style={{ padding: '9px 270px' }}
              className="flex-1 bg-transparent outline-none text-sm text-gray-700 placeholder-gray-400"
            />
            <Mic size={18} color="#000000" strokeWidth={2} style={{ cursor: 'pointer' }} />
          </div>
        ) : (
          <div style={{ width: '800px', margin: '10px 30px' }} />
        )}
      </div>
    </header>
  );
}
