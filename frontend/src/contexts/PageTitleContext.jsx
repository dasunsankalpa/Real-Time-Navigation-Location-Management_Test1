import React, { createContext, useContext, useState, useRef } from 'react';

const PageTitleContext = createContext();

export const usePageTitle = () => {
  const context = useContext(PageTitleContext);
  if (!context) {
    throw new Error('usePageTitle must be used within a PageTitleProvider');
  }
  return context;
};

export const PageTitleProvider = ({ children }) => {
  const [title, setTitle] = useState(' ');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchedPlace, setSearchedPlace] = useState(null);
  const [activePage, setActivePage] = useState('explore');
  const [userLocation, setUserLocation] = useState(null);
  const [pendingOriginLabel, setPendingOriginLabel] = useState('');
  const [pendingVehicle, setPendingVehicle] = useState(null);
  const [etaData, setEtaData] = useState(null);
  const [safetyData, setSafetyData] = useState(null);
  const onNavigateRef = useRef(null);

  const setOnNavigate = (fn) => { onNavigateRef.current = fn; };
  const navigateToSearch = (place) => {
    onNavigateRef.current?.(place);
    setHasSearched(true);
    setSearchedPlace(place);
  };

  return (
    <PageTitleContext.Provider value={{
      title, setTitle,
      showSearchBar, setShowSearchBar,
      hasSearched, setHasSearched,
      searchedPlace, setSearchedPlace,
      activePage, setActivePage,
      userLocation, setUserLocation,
      pendingOriginLabel, setPendingOriginLabel,
      pendingVehicle, setPendingVehicle,
      etaData, setEtaData,
      safetyData, setSafetyData,
      setOnNavigate, navigateToSearch,
    }}>
      {children}
    </PageTitleContext.Provider>
  );
};
