import firstMap from '../assets/firstMap.png';
import middle from '../assets/middle.png';
import exploreIcon from '../assets/explore.png';
import userIcon from '../assets/userIcon.png';
import directionIcon from '../assets/directionIcon.png';
import directionCircle from '../assets/directionCircle.png';
import locationRed from '../assets/locationRed.png';
import { usePageTitle } from '../contexts/PageTitleContext';
import { useEffect } from 'react';



const Explore = () => {
  const { setShowSearchBar } = usePageTitle();

  useEffect(() => {
    setShowSearchBar(true);
    return () => setShowSearchBar(false); // cleanup when leaving page
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

      {/* Map image - middle area */}
      <div
        className="relative z-10 flex justify-center"
        style={{ marginTop: '20px', marginBottom: '50px', marginLeft: '1px', marginRight: '1px', padding: '15px' }}
      >
        {/* Map with directionIcon anchored to bottom-right */}
        <div className="relative" style={{ width: '100%', maxWidth: '1300px' }}>
          <img
            src={firstMap}
            alt="Map"
            style={{ width: '100%', borderRadius: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.15)', display: 'block' }}
          />
          {/* directionIcon - bottom-right of map, adjust bottom/right/width values */}
          <img
            src={directionIcon}
            alt="Direction"
            style={{ position: 'absolute', bottom: '20px', right: '50px', width: '130px', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Icons row between map and footer - adjust margin/padding to fine-tune gap */}
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

