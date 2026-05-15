import Explore from './pages/Explore';
import Footer from './components/Footer';
import Header from './components/Header';
import { PageTitleProvider } from './contexts/PageTitleContext';

export default function App() {
  return (
    <PageTitleProvider>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />
        <div style={{ flex: 1, position: 'relative' }}>

          <Explore />


        </div>
        <Footer />
      </div>
    </PageTitleProvider>
  );
}
