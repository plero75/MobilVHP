import React, { useState, useCallback } from 'react';
import { Header } from '../components/Header';
import { StatusBar } from '../components/StatusBar';
import { TransportSection } from '../components/TransportSection';
import { VelibCard } from '../components/VelibCard';
import { SytadinCard } from '../components/SytadinCard';
import { NewsCard } from '../components/NewsCard';
import { CoursesSection } from '../components/CoursesSection';
import { Footer } from '../components/Footer';
import { ErrorBoundary } from '../components/ErrorBoundary';

const App: React.FC = () => {
  // États de statut pour chaque module
  const [transportStatus, setTransportStatus] = useState<'ok' | 'warning' | 'error' | 'loading'>('loading');
  const [transportLastUpdate, setTransportLastUpdate] = useState<string>();
  const [transportErrors, setTransportErrors] = useState(0);

  const [velibStatus, setVelibStatus] = useState<'ok' | 'warning' | 'error' | 'loading'>('loading');
  const [velibLastUpdate, setVelibLastUpdate] = useState<string>();
  const [velibErrors, setVelibErrors] = useState(0);

  const [newsStatus, setNewsStatus] = useState<'ok' | 'warning' | 'error' | 'loading'>('loading');
  const [newsLastUpdate, setNewsLastUpdate] = useState<string>();
  const [newsErrors, setNewsErrors] = useState(0);

  const [coursesStatus, setCoursesStatus] = useState<'ok' | 'warning' | 'error' | 'loading'>('loading');
  const [coursesLastUpdate, setCoursesLastUpdate] = useState<string>();
  const [coursesErrors, setCoursesErrors] = useState(0);

  // Force le rafraîchissement global
  const [refreshKey, setRefreshKey] = useState(0);

  const handleGlobalRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
    // Reset tous les statuts à loading
    setTransportStatus('loading');
    setVelibStatus('loading');
    setNewsStatus('loading');
    setCoursesStatus('loading');
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-2 md:p-4">
      <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
        <Header />
        
        <StatusBar
          transportStatus={transportStatus}
          transportLastUpdate={transportLastUpdate}
          transportErrors={transportErrors}
          velibStatus={velibStatus}
          velibLastUpdate={velibLastUpdate}
          velibErrors={velibErrors}
          newsStatus={newsStatus}
          newsLastUpdate={newsLastUpdate}
          newsErrors={newsErrors}
          coursesStatus={coursesStatus}
          coursesLastUpdate={coursesLastUpdate}
          coursesErrors={coursesErrors}
          onRefresh={handleGlobalRefresh}
        />

        <ErrorBoundary onRetry={() => setTransportStatus('loading')}>
          <TransportSection key={`transport-${refreshKey}`} />
        </ErrorBoundary>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <ErrorBoundary onRetry={() => setVelibStatus('loading')}>
            <VelibCard key={`velib-${refreshKey}`} />
          </ErrorBoundary>
          
          <ErrorBoundary onRetry={() => setNewsStatus('loading')}>
            <NewsCard key={`news-${refreshKey}`} />
          </ErrorBoundary>
        </div>

        <SytadinCard />
        
        <ErrorBoundary onRetry={() => setCoursesStatus('loading')}>
          <CoursesSection key={`courses-${refreshKey}`} />
        </ErrorBoundary>
        
        <Footer />
      </div>
    </div>
  );
};

export default App;