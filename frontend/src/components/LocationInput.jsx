import { useState, useEffect } from 'react';
import { Search, MapPin, Clock } from 'lucide-react';
import { useLocationSearch } from '../utils/useLocationSearch';


const HISTORY_KEY = 'locationSearchHistory';

const getHistory = () => {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
};

const saveToHistory = (name) => {
  if (!name?.trim()) return;
  const prev = getHistory().filter(h => h !== name);
  localStorage.setItem(HISTORY_KEY, JSON.stringify([name, ...prev].slice(0, 5)));
};

export default function LocationInput({
  icon,
  placeholder,
  initialValue = '',
  onSelect,
  showGps = false,
  onGpsSelect,
  gpsDisplayValue = '[Your Location]',
  readOnly = false,
  staticValue,
  showDropdown = true,
}) {
  const {
    query, setQuery, suggestions, activeIdx, setActiveIdx,
    containerRef, handleChange, handleSearch, handleKeyDown, confirmPlace,
  } = useLocationSearch((place) => {
    saveToHistory(place.displayName);
    onSelect(place);
  }, initialValue);

  const [focused, setFocused] = useState(false);
  const history = getHistory();

  const inputValue = staticValue != null ? staticValue : query;
  const allowDropdown = showDropdown && !readOnly && staticValue == null;

  // Show pre-focus dropdown: history only (only when query is empty and focused)
  const showPrefocus = allowDropdown && focused && !query.trim() && history.length > 0;
  // Show API suggestions while typing
  const showSuggestions = allowDropdown && suggestions.length > 0;

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1 }}>
      <div className="flex items-center gap-2 min-w-0" style={{ flex: 1 }}>
        {icon}
        <div className="flex items-center min-w-0" style={{ flex: 1 }}>
          <input
            type="text"
            value={inputValue}
            readOnly={readOnly || staticValue != null}
            onChange={readOnly || staticValue != null ? undefined : handleChange}
            onKeyDown={readOnly || staticValue != null ? undefined : handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder={placeholder}
            className="bg-transparent outline-none text-sm text-gray-700 placeholder-gray-400"
            style={{ flex: 1, minWidth: 0 }}
          />
          {!readOnly && staticValue == null && query.trim() && (
            <Search
              size={14}
              color="#6B7280"
              strokeWidth={2}
              style={{ cursor: 'pointer', flexShrink: 0, marginLeft: '6px' , marginRight: '500px'}}
              onClick={handleSearch}
            />
          )}
        </div>
      </div>

      {/* Pre-focus dropdown: history only */}
      {showPrefocus && !showSuggestions && (
        <ul style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: '#fff', borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          zIndex: 9999, listStyle: 'none', margin: 0, padding: '8px 0',
        }}>
          {history.map((h, i) => (
            <li
              key={i}
              onMouseDown={() => {
                setFocused(false);
                if (window.google?.maps) {
                  const geocoder = new window.google.maps.Geocoder();
                  geocoder.geocode({ address: h, componentRestrictions: { country: 'lk' } }, (results, status) => {
                    if (status === 'OK' && results[0]) onSelect({ ...results[0], displayName: h });
                  });
                }
              }}
              style={{
                padding: '16px 12px 8px 10px', cursor: 'pointer', fontSize: '15px', color: '#333',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}
            >
              <Clock size={30} color="#6B7280" />
              <span>{h}</span>
            </li>
          ))}
        </ul>
      )}

      {/* API suggestions while typing */}
      {showSuggestions && (
        <ul style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: '#fff', borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          zIndex: 9999, listStyle: 'none', margin: 0, padding: '4px 0',
          maxHeight: '220px', overflowY: 'auto',
        }}>
          {suggestions.map((p, i) => (
            <li
              key={p.place_id}
              onMouseDown={() => confirmPlace(p.place_id, p.structured_formatting.main_text)}
              onMouseEnter={() => setActiveIdx(i)}
              style={{
                padding: '9px 14px', cursor: 'pointer', fontSize: '13px', color: '#333',
                background: i === activeIdx ? '#EFF6FF' : 'transparent',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}
            >
              <MapPin size={13} color="#6B7280" />
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
  );
}
