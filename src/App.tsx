import React from 'react';
import { Header } from '../components/Header';
import { TransportSection } from '../components/TransportSection';
import { VelibCard } from '../components/VelibCard';
import { SytadinCard } from '../components/SytadinCard';
import { NewsCard } from '../components/NewsCard';
import { CoursesSection } from '../components/CoursesSection';
import { Footer } from '../components/Footer';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <Header />
        <TransportSection />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <VelibCard />
          <NewsCard />
        </div>

        <SytadinCard />
        <CoursesSection />
        <Footer />
      </div>
    </div>
  );
};

export default App;
