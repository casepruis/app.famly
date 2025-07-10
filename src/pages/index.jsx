import Layout from "./Layout.jsx";

import Dashboard from "./Dashboard";

import FamilyMembers from "./FamilyMembers";

import Schedule from "./Schedule";

import Tasks from "./Tasks";

import AIAssistant from "./AIAssistant";

import Connectors from "./Connectors";

import Index from "./Index";

import Admin from "./Admin";

import FamilySetup from "./FamilySetup";

import PlatformAdmin from "./PlatformAdmin";

import DataCleanup from "./DataCleanup";

import Wishlist from "./Wishlist";

import Chat from "./Chat";

import DatabaseRecovery from "./DatabaseRecovery";

import Debug from "./Debug";

import Events from "./Events";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    Dashboard: Dashboard,
    
    FamilyMembers: FamilyMembers,
    
    Schedule: Schedule,
    
    Tasks: Tasks,
    
    AIAssistant: AIAssistant,
    
    Connectors: Connectors,
    
    Index: Index,
    
    Admin: Admin,
    
    FamilySetup: FamilySetup,
    
    PlatformAdmin: PlatformAdmin,
    
    DataCleanup: DataCleanup,
    
    Wishlist: Wishlist,
    
    Chat: Chat,
    
    DatabaseRecovery: DatabaseRecovery,
    
    Debug: Debug,
    
    Events: Events,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Dashboard />} />
                
                
                <Route path="/Dashboard" element={<Dashboard />} />
                
                <Route path="/FamilyMembers" element={<FamilyMembers />} />
                
                <Route path="/Schedule" element={<Schedule />} />
                
                <Route path="/Tasks" element={<Tasks />} />
                
                <Route path="/AIAssistant" element={<AIAssistant />} />
                
                <Route path="/Connectors" element={<Connectors />} />
                
                <Route path="/Index" element={<Index />} />
                
                <Route path="/Admin" element={<Admin />} />
                
                <Route path="/FamilySetup" element={<FamilySetup />} />
                
                <Route path="/PlatformAdmin" element={<PlatformAdmin />} />
                
                <Route path="/DataCleanup" element={<DataCleanup />} />
                
                <Route path="/Wishlist" element={<Wishlist />} />
                
                <Route path="/Chat" element={<Chat />} />
                
                <Route path="/DatabaseRecovery" element={<DatabaseRecovery />} />
                
                <Route path="/Debug" element={<Debug />} />
                
                <Route path="/Events" element={<Events />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}