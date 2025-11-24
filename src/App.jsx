import './App.css';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { LanguageProvider } from '@/components/common/LanguageProvider';
import { FamilyDataProvider } from '@/hooks/FamilyDataContext';
import { useTimezoneDetection } from '@/hooks/useTimezoneDetection';
import PageWithLayout from '@/pages/PageWithLayout'; // new helper component

import Index from '@/pages/index';
import RequireAuth from '@/pages/RequireAuth';
import SignIn from '@/pages/SignIn';
import SignUp from '@/pages/SignUp';
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
import ResetPasswordRequest from '@/pages/ResetPasswordRequest';
import ResetPassword from '@/pages/ResetPassword';

function App() {
  // Automatically detect and store user timezone
  useTimezoneDetection();

  return (
    <LanguageProvider>
      <FamilyDataProvider>
        <Routes>
          <Route path="/" element={<PageWithLayout><Index /></PageWithLayout>} />
          <Route path="/index" element={<Navigate to="/" replace />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/dashboard" element={<RequireAuth><PageWithLayout><Dashboard /></PageWithLayout></RequireAuth>} />
          <Route path="/familysetup" element={<RequireAuth><PageWithLayout><FamilySetup /></PageWithLayout></RequireAuth>} />
          <Route path="/schedule" element={<RequireAuth><PageWithLayout><Schedule /></PageWithLayout></RequireAuth>} />
          <Route path="/tasks" element={<RequireAuth><PageWithLayout><Tasks /></PageWithLayout></RequireAuth>} />
          <Route path="/events" element={<RequireAuth><PageWithLayout><Events /></PageWithLayout></RequireAuth>} />
          <Route path="/wishlist" element={<RequireAuth><PageWithLayout><Wishlist /></PageWithLayout></RequireAuth>} />
          <Route path="/familymembers" element={<RequireAuth><PageWithLayout><FamilyMembers /></PageWithLayout></RequireAuth>} />
          <Route path="/connectors" element={<RequireAuth><PageWithLayout><Connectors /></PageWithLayout></RequireAuth>} />
          <Route path="/chat" element={<RequireAuth><PageWithLayout><Chat /></PageWithLayout></RequireAuth>} />
          <Route path="/aiassistant" element={<RequireAuth><PageWithLayout><AIAssistant /></PageWithLayout></RequireAuth>} />
          <Route path="/debug" element={<RequireAuth><PageWithLayout><Debug /></PageWithLayout></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth><PageWithLayout><Admin /></PageWithLayout></RequireAuth>} />
          <Route path="/platformadmin" element={<RequireAuth><PageWithLayout><PlatformAdmin /></PageWithLayout></RequireAuth>} />
          <Route path="/datacleanup" element={<RequireAuth><PageWithLayout><DataCleanup /></PageWithLayout></RequireAuth>} />
          <Route path="/databaserecovery" element={<RequireAuth><PageWithLayout><DatabaseRecovery /></PageWithLayout></RequireAuth>} />
          <Route path="/reset-password-request" element={<ResetPasswordRequest />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
        <Toaster />
      </FamilyDataProvider>
    </LanguageProvider>
  );
}

export default App;
