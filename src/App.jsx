
import AddStopPlaces from './pages/AddStopPlaces';
import Direction from './pages/Direction';
import DirectionOne from './pages/DirectionOne';
import EtaPage from './pages/EtaPage';
import Explore from './pages/Explore';
import SafetyAlertTemplate from './pages/SafetyAlertTemplate';
import SerchPage from './pages/SerchPage';
import StartPage from './pages/StartPage';
import UserPage from './pages/UserPage';
import Footer from './components/Footer';
import Header from './components/Header';
import { PageTitleProvider } from './contexts/PageTitleContext';

export default function App() {
  return (
    <PageTitleProvider>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />
        <div style={{ flex: 1, position: 'relative' }}>
          <EtaPage />
                 
        </div>
        <Footer />
      </div>
    </PageTitleProvider>
  );
}
