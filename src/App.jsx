import './App.css';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { LanguageProvider } from '@/components/common/LanguageProvider';
import Layout from '@/pages/Layout';

import Index from '@/pages/Index';
import Dashboard from '@/pages/Dashboard';
import FamilySetup from '@/pages/FamilySetup';
import Schedule from '@/pages/Schedule';
import Tasks from '@/pages/Tasks';
import Events from '@/pages/Events';
import Wishlist from '@/pages/Wishlist';
import FamilyMembers from '@/pages/FamilyMembers';
import Connectors from '@/pages/Connectors';
import Chat from '@/pages/Chat';
import AIAssistant from '@/pages/AIAssistant';
import Debug from '@/pages/Debug';
import Admin from '@/pages/Admin';
import PlatformAdmin from '@/pages/PlatformAdmin';
import DataCleanup from '@/pages/DataCleanup';
import DatabaseRecovery from '@/pages/DatabaseRecovery';

function App() {
  return (
    <LanguageProvider>
      <Routes>
        <Route path="/" element={<Layout><Index /></Layout>} />
        <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
        <Route path="/familysetup" element={<Layout><FamilySetup /></Layout>} />
        <Route path="/schedule" element={<Layout><Schedule /></Layout>} />
        <Route path="/tasks" element={<Layout><Tasks /></Layout>} />
        <Route path="/events" element={<Layout><Events /></Layout>} />
        <Route path="/wishlist" element={<Layout><Wishlist /></Layout>} />
        <Route path="/familymembers" element={<Layout><FamilyMembers /></Layout>} />
        <Route path="/connectors" element={<Layout><Connectors /></Layout>} />
        <Route path="/chat" element={<Layout><Chat /></Layout>} />
        <Route path="/aiassistant" element={<Layout><AIAssistant /></Layout>} />
        <Route path="/debug" element={<Layout><Debug /></Layout>} />
        <Route path="/admin" element={<Layout><Admin /></Layout>} />
        <Route path="/platformadmin" element={<Layout><PlatformAdmin /></Layout>} />
        <Route path="/datacleanup" element={<Layout><DataCleanup /></Layout>} />
        <Route path="/databaserecovery" element={<Layout><DatabaseRecovery /></Layout>} />
      </Routes>
      <Toaster />
    </LanguageProvider>
  );
}

export default App;
