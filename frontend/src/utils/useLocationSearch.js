import { useState, useRef, useCallback, useEffect } from 'react';
import { ensureMapsScript } from './helpers';

const SRI_LANKA_BOUNDS = { north: 10.0, south: 5.7, east: 82.1, west: 79.4 };

export function useLocationSearch(onSelect, initialValue = '') {
  const [query, setQuery] = useState(initialValue); // ← seeded once, never overridden
  const [suggestions, setSuggestions] = useState([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const acServiceRef = useRef(null);
  const geocoderRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    ensureMapsScript(() => {
      acServiceRef.current = new window.google.maps.places.AutocompleteService();
      geocoderRef.current = new window.google.maps.Geocoder();
    });
  }, []);

  const fetchSuggestions = useCallback((input) => {
    if (!input.trim() || !acServiceRef.current) { setSuggestions([]); return; }
    acServiceRef.current.getPlacePredictions(
      {
        input,
        componentRestrictions: { country: 'lk' },
        bounds: new window.google.maps.LatLngBounds(
          { lat: SRI_LANKA_BOUNDS.south, lng: SRI_LANKA_BOUNDS.west },
          { lat: SRI_LANKA_BOUNDS.north, lng: SRI_LANKA_BOUNDS.east }
        ),
      },
      (predictions, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
          setSuggestions(predictions);
        } else {
          setSuggestions([]);
        }
      }
    );
  }, []);

  const confirmPlace = useCallback((placeId, displayName) => {
    setSuggestions([]);
    geocoderRef.current?.geocode({ placeId }, (results, status) => {
      if (status === 'OK' && results[0]) {
        setQuery(displayName);
        onSelect({ ...results[0], displayName });
      }
    });
  }, [onSelect]);

  const handleChange = useCallback((e) => {
    const val = e.target.value;
    setQuery(val);
    setActiveIdx(-1);
    fetchSuggestions(val);
  }, [fetchSuggestions]);

  const handleSearch = useCallback(() => {
    const q = query.trim();
    if (!q || !geocoderRef.current) return;
    geocoderRef.current.geocode(
      { address: q, componentRestrictions: { country: 'lk' } },
      (results, status) => {
        if (status === 'OK' && results[0]) {
          setSuggestions([]);
          setQuery(q);
          onSelect({ ...results[0], displayName: q });
        } else {
          fetchSuggestions(q);
        }
      }
    );
  }, [query, onSelect, fetchSuggestions]);

  const handleKeyDown = useCallback((e) => {
    if (!suggestions.length) { if (e.key === 'Enter') handleSearch(); return; }
    if (e.key === 'ArrowDown') { setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { setActiveIdx(i => Math.max(i - 1, -1)); e.preventDefault(); }
    else if (e.key === 'Enter') {
      if (activeIdx >= 0) confirmPlace(suggestions[activeIdx].place_id, suggestions[activeIdx].structured_formatting.main_text);
      else handleSearch();
    }
    else if (e.key === 'Escape') setSuggestions([]);
  }, [suggestions, activeIdx, handleSearch, confirmPlace]);

  // close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (!containerRef.current?.contains(e.target)) setSuggestions([]); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return { query, setQuery, suggestions, activeIdx, setActiveIdx, containerRef, handleChange, handleSearch, handleKeyDown, confirmPlace };
}
