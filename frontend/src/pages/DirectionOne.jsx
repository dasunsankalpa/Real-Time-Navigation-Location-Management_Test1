import { useState } from 'react';
import middle from '../assets/middle.png';
import bikeIcon from '../assets/bikeIcon.png';
import busIcon from '../assets/busIcon.png';
import carIcon from '../assets/carIcon.png';
import clockIcon from '../assets/clockIcon.png';
import directionCircle from '../assets/directionCircle.png';
import locationRed from '../assets/locationRed.png';
import manIcon from '../assets/manIcon.png';
import upDown from '../assets/upDown.png';

const recentPlaces = [
  'Galgamuwa',
  'Kurunegala',
  'Down Town Depot Mahawa',
  'Anuradhapura',
  'Polonnaruwa',
  'Jaffna',
];

const DirectionOne = () => {
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  const vehicles = [
    { key: 'bus',  src: busIcon,  alt: 'Bus',  className: 'w-12 h-12' },
    { key: 'bike', src: bikeIcon, alt: 'Bike', className: 'w-12 h-12' },
    { key: 'car',  src: carIcon,  alt: 'Car',  className: 'w-12.3 h-9'  },
    { key: 'man',  src: manIcon,  alt: 'Walk', className: 'w-12 h-11.3' },
  ];

  return (
    <div className="relative w-full min-h-screen bg-[#e3f3fc] flex flex-col items-center">
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
        className="relative z-10 flex items-center"
        style={{ marginTop: '20px', marginLeft: '700px', gap: '12px' }}
      >
        {/* Two text box rows */}
        <div className="flex flex-col" style={{ gap: '20px' }}>
          {/* directionCircle row */}
          <div className="flex items-center">
            <img src={directionCircle} alt="Your location" style={{ width: '48px', height: '48px', marginRight: '10px' }} />
            <div
              className="bg-gradient-to-r from-[#FFFFFF] to-[#A0DBFF] shadow text-full text-center font-bold"
              style={{ borderRadius: '8px', padding: '16px 24px', width: '700px' }}
            >
              Your location
            </div>
          </div>
          {/* locationRed row */}
          <div className="flex items-center">
            <img src={locationRed} alt="Destination" style={{ width: '48px', height: '48px', marginRight: '10px' }} />
            <div
              className="bg-gradient-to-r from-[#FFFFFF] to-[#A0DBFF] shadow text-full text-center font-bold"
              style={{ borderRadius: '8px', padding: '16px 24px', width: '700px' }}
            >
              Choose Destination
            </div>
          </div>
        </div>

        {/* Single upDown icon beside both boxes - adjust marginLeft/width */}
        <img
          src={upDown}
          alt="Swap"
          style={{ width: '40px', marginLeft: '20px', cursor: 'pointer',marginRight: '720px' }}
        />
      </div>

      {/* Transport Icons */}
<div className="relative z-10 flex justify-center gap-32 mt-6 mb-10 ">
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
