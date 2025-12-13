import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LandingPage from './components/LandingPage';
import Processor from './components/Processor';
import Dashboard from './components/Dashboard';

function App() {
  const [view, setView] = useState('landing'); // landing, scanning, results
  const [targetData, setTargetData] = useState(null);
  const [scanResults, setScanResults] = useState(null);

  const startScan = (data) => {
    // If data isn't provided (e.g. from a generic CTA), prompt or use defaults for demo
    // For this flow, we'll assume the user clicks "Start AIO" and we might show a modal or just jump to a demo scan if no input
    // To keep it simple based on previous logic:
    if (data) {
      setTargetData(data);
    } else {
      // Fallback for "Structurer mon site" buttons that don't pass form data yet. 
      // In a real app, this would open a modal. For now, let's mock a "Demo Company".
      setTargetData({ name: "Votre Entreprise", url: "https://votre-site.com", sector: "General" });
    }
    setView('scanning');
  };

  const onScanComplete = (results) => {
    setScanResults(results);
    setView('results');
  };

  const reset = () => {
    setView('landing');
    setTargetData(null);
    setScanResults(null);
  };

  return (
    <div className="app-container">
      <AnimatePresence mode="wait">
        {view === 'landing' && (
          <motion.div key="landing" exit={{ opacity: 0 }}>
            <LandingPage onStartScan={() => startScan(null)} />
          </motion.div>
        )}
        {view === 'scanning' && (
          <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Processor
              target={targetData}
              onComplete={onScanComplete}
            />
          </motion.div>
        )}
        {view === 'results' && (
          <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Dashboard
              data={scanResults}
              target={targetData}
              onReset={reset}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
