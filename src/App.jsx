import './App.css';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { LanguageProvider } from '@/components/common/LanguageProvider';
import PageWithLayout from '@/pages/PageWithLayout'; // new helper component

import Index from '@/pages/index';
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
        <Route path="/" element={<PageWithLayout><Index /></PageWithLayout>} />
        <Route path="/index" element={<Navigate to="/" replace />} />
        <Route path="/dashboard" element={<PageWithLayout><Dashboard /></PageWithLayout>} />
        <Route path="/familysetup" element={<PageWithLayout><FamilySetup /></PageWithLayout>} />
        <Route path="/schedule" element={<PageWithLayout><Schedule /></PageWithLayout>} />
        <Route path="/tasks" element={<PageWithLayout><Tasks /></PageWithLayout>} />
        <Route path="/events" element={<PageWithLayout><Events /></PageWithLayout>} />
        <Route path="/wishlist" element={<PageWithLayout><Wishlist /></PageWithLayout>} />
        <Route path="/familymembers" element={<PageWithLayout><FamilyMembers /></PageWithLayout>} />
        <Route path="/connectors" element={<PageWithLayout><Connectors /></PageWithLayout>} />
        <Route path="/chat" element={<PageWithLayout><Chat /></PageWithLayout>} />
        <Route path="/aiassistant" element={<PageWithLayout><AIAssistant /></PageWithLayout>} />
        <Route path="/debug" element={<PageWithLayout><Debug /></PageWithLayout>} />
        <Route path="/admin" element={<PageWithLayout><Admin /></PageWithLayout>} />
        <Route path="/platformadmin" element={<PageWithLayout><PlatformAdmin /></PageWithLayout>} />
        <Route path="/datacleanup" element={<PageWithLayout><DataCleanup /></PageWithLayout>} />
        <Route path="/databaserecovery" element={<PageWithLayout><DatabaseRecovery /></PageWithLayout>} />
      </Routes>
      <Toaster />
    </LanguageProvider>
  );
}

export default App;
