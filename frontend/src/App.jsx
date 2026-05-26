import Explore from './pages/Explore';
import Direction from './pages/Direction';
import DirectionOne from './pages/DirectionOne';
import EtaPage from './pages/EtaPage';
import SafetyAlertTemplate from './pages/SafetyAlertTemplate';
import Footer from './components/Footer';
import Header from './components/Header';
import { PageTitleProvider, usePageTitle } from './contexts/PageTitleContext';

// ─── DEV ONLY ─────────────────────────────────────────────
//const DEV_PAGE = 'direction'; // change to any page name to preview it
// available: 'explore' | 'direction' | 'addStop' | 'directionOne' | 'eta' | 'safety' | 'start' | 'user'
// ──────────────────────────────────────────────────────────

const PAGES = {
  explore:      <Explore />,
  direction:    <Direction />,
  directionOne: <DirectionOne />,
  eta:          <EtaPage />,
  safety:       <SafetyAlertTemplate />,
  start:        <Direction showDetailsPanel={false} />,
};

function AppContent() {
  const { activePage } = usePageTitle();
  const page = PAGES[activePage] ?? <Explore />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      <div style={{ flex: 1, position: 'relative' }}>
        {page}
      </div>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <PageTitleProvider>
      <AppContent />
    </PageTitleProvider>
  );
}
