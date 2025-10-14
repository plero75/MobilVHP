import React from 'react';
import { Header } from './components/Header';
import { TransportSection } from './components/TransportSection';
import { VelibCard } from './components/VelibCard';
import { SytadinCard } from './components/SytadinCard';
import { NewsCard } from './components/NewsCard';
import { CoursesSection } from './components/CoursesSection';
import { Footer } from './components/Footer';

const App: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow">
        <div className="p-4 space-y-4">
          <TransportSection />
          <VelibCard />
          <SytadinCard />
          <NewsCard />
          <CoursesSection />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default App;