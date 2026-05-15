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
  const onNavigateRef = useRef(null);

  const setOnNavigate = (fn) => { onNavigateRef.current = fn; };
  const navigateToSearch = (place) => { onNavigateRef.current?.(place); };

  return (
    <PageTitleContext.Provider value={{
      title, setTitle,
      showSearchBar, setShowSearchBar,
      setOnNavigate, navigateToSearch,
    }}>
      {children}
    </PageTitleContext.Provider>
  );
};
