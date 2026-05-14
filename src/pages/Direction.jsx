import firstMap from '../assets/firstMap.png';
import middle from '../assets/middle.png';

// If you meant a different image, change 'Logo' to the correct import (e.g., import startMap from '../assets/startMap.png')

const Explore = () => {
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
      {/* Centered startMap image on top of background */}

    </div>
  );
};

export default Explore;

