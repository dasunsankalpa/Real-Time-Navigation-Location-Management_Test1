import React, { useState, useEffect } from 'react';
import { AlertTriangle, Megaphone, Wind, Phone } from 'lucide-react';
import bottomLogo from '../assets/bottomLogo.png';
import Logo from '../assets/Logo.png';
import Lotus from '../assets/Lotus.png';
import middle from '../assets/middle.png';
import { usePageTitle } from '../contexts/PageTitleContext';

export default function SafetyAlertTemplate() {
  const { setTitle } = usePageTitle();

  useEffect(() => {
    setTitle('Safety Alert');
  }, [setTitle]);
  const [alerts] = useState([
    { id: 1, type: 'weather', icon: <AlertTriangle className="w-6 h-6" />, title: 'Weather alert', description: 'High wind and rough sea conditions expected today' },
    { id: 2, type: 'beach', icon: <Megaphone className="w-6 h-6" />, title: 'Beach/Pool closed', description: 'Beach temporarily closed due to safety concerns' },
    { id: 3, type: 'air', icon: <Wind className="w-6 h-6" />, title: 'Poor air quality', description: 'Air quality index high - limit outdoor activities' }
  ]);

  const [emergencyContacts] = useState([
    { name: 'Police', number: '119' },
    { name: 'Ambulance', number: '1990' },
    { name: 'Tourist police', number: '1912' }
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-blue-200 relative overflow-hidden font-sans" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="absolute top-0 left-0 right-0 h-32 overflow-hidden">
        <img src={bottomLogo} alt="Decorative pattern" className="w-full h-full object-cover opacity-60 scale-x-150" />
      </div>

      <main className="relative z-10 max-w-4xl mx-auto px-4 py-12">
        <div className="absolute inset-0 z-0 opacity-40">
          <img src={middle} alt="Ocean background" className="w-full h-full object-cover scale-x-[1.7]" />
        </div>

        <div className="relative z-10 space-y-4 mb-12">
          {alerts.map((alert) => (
            <div key={alert.id} className="bg-gradient-to-r from-yellow-100 to-yellow-200 rounded-xl p-6 shadow-lg flex items-start gap-4 transition-transform hover:scale-[1.02]">
              <div className="bg-yellow-400 rounded-full p-3 text-gray-800">{alert.icon}</div>
              <div className="flex-1">
                <h3 className="font-bold text-lg text-gray-800 mb-1">{alert.title}</h3>
                <p className="text-gray-700 text-sm">{alert.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8 relative z-10">
          <h2 className="text-center text-red-600 font-bold text-xl mb-6">Emergency contact</h2>
          <div className="space-y-4">
            {emergencyContacts.map((contact, index) => (
              <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="bg-gray-200 rounded-full p-3">
                  <Phone className="w-6 h-6 text-gray-700" />
                </div>
                <div className="flex-1">
                  <span className="font-semibold text-gray-800">{contact.name}: </span>
                  <span className="text-gray-700 font-bold">{contact.number}</span>
                </div>
              </div>
            ))}
          </div>
          <button className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors shadow-md">Back</button>
        </div>
      </main>

    </div>
  );
}
