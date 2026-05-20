import { useEffect } from 'react';
import Direction from './Direction';

import { usePageTitle } from '../contexts/PageTitleContext';


const StartPage = () => {
  const { setShowSearchBar } = usePageTitle();

  useEffect(() => {
    setShowSearchBar(true);
  }, [setShowSearchBar]);

  return <Direction showDetailsPanel={false} />;
};

export default StartPage;
