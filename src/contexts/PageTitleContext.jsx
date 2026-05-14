import React, { createContext, useContext, useState } from 'react';

const PageTitleContext = createContext();

export const usePageTitle = () => {
  const context = useContext(PageTitleContext);
  if (!context) {
    throw new Error('usePageTitle must be used within a PageTitleProvider');
  }
  return context;
};

export const PageTitleProvider = ({ children }) => {
  const [title, setTitle] = useState(" ");
  const [showSearchBar, setShowSearchBar] = useState(false);

  return (
    <PageTitleContext.Provider value={{ title, setTitle, showSearchBar, setShowSearchBar }}>
      {children}
    </PageTitleContext.Provider>
  );
};