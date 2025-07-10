
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/components/common/LanguageProvider';
import { 
  Mail, 
  Calendar as CalendarIcon, 
  MessageSquare, 
  Smartphone, 
  Camera,
  Music,
  ShoppingCart,
  Briefcase,
  Plus,
  Settings,
  Zap
} from 'lucide-react';

const AVAILABLE_CONNECTORS = [
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Connect your Gmail to automatically create events and tasks from emails',
    icon: Mail,
    status: 'available',
    category: 'Email',
    color: 'text-red-500'
  },
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    description: 'Sync your existing Google Calendar with famly.ai',
    icon: CalendarIcon,
    status: 'available',
    category: 'Calendar',
    color: 'text-blue-500'
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Send family updates and reminders via WhatsApp',
    icon: MessageSquare,
    status: 'coming_soon',
    category: 'Messaging',
    color: 'text-green-500'
  },
  {
    id: 'apple_calendar',
    name: 'Apple Calendar',
    description: 'Sync with your Apple Calendar and iCloud',
    icon: CalendarIcon,
    status: 'coming_soon',
    category: 'Calendar',
    color: 'text-gray-500'
  },
  {
    id: 'ios_shortcuts',
    name: 'iOS Shortcuts',
    description: 'Create Siri shortcuts for quick task and event creation',
    icon: Smartphone,
    status: 'coming_soon',
    category: 'Mobile',
    color: 'text-blue-400'
  },
  {
    id: 'google_photos',
    name: 'Google Photos',
    description: 'Automatically organize family photos and create shared albums',
    icon: Camera,
    status: 'coming_soon',
    category: 'Photos',
    color: 'text-yellow-500'
  },
  {
    id: 'spotify',
    name: 'Spotify',
    description: 'Create family playlists and share music recommendations',
    icon: Music,
    status: 'coming_soon',
    category: 'Entertainment',
    color: 'text-green-600'
  },
  {
    id: 'amazon',
    name: 'Amazon',
    description: 'Track orders and add items to shared shopping lists',
    icon: ShoppingCart,
    status: 'coming_soon',
    category: 'Shopping',
    color: 'text-orange-500'
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Connect work Slack for work-life balance insights',
    icon: Briefcase,
    status: 'coming_soon',
    category: 'Work',
    color: 'text-purple-500'
  }
];

export default function Connectors() {
  const [connectors, setConnectors] = useState([]);
  const [activeConnectors, setActiveConnectors] = useState([]);
  const { t } = useLanguage();

  useEffect(() => {
    loadConnectors();
  }, []);

  const loadConnectors = async () => {
    // In a real implementation, this would load from the database
    setConnectors(AVAILABLE_CONNECTORS);
    setActiveConnectors([]); // No active connectors yet
  };

  const handleConnectorAction = (connector) => {
    if (connector.status === 'available') {
      // TODO: Implement actual connector setup
      alert(`Setting up ${connector.name} connector - Coming soon!`);
    }
  };

  const groupedConnectors = connectors.reduce((groups, connector) => {
    const category = connector.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(connector);
    return groups;
  }, {});

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {t('connectors') || 'Connectors'}
        </h1>
        <p className="text-gray-600">
          {t('connectorsDescription') || 'Connect your favorite apps and services to streamline your family life.'}
        </p>
      </div>

      {activeConnectors.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-green-500" />
              {t('activeConnectors') || 'Active connectors'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeConnectors.map((connector) => {
                const IconComponent = connector.icon;
                return (
                  <div key={connector.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <IconComponent className={`w-6 h-6 ${connector.color}`} />
                      <div>
                        <h3 className="font-semibold text-gray-900">{connector.name}</h3>
                        <p className="text-xs text-green-700 font-medium">{t('connected') || 'Connected'}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600">
                      <Settings className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-8">
        {Object.entries(groupedConnectors).map(([category, categoryConnectors]) => (
          <div key={category}>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              {t(category.toLowerCase()) || category}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categoryConnectors.map((connector) => {
                const IconComponent = connector.icon;
                return (
                  <Card key={connector.id} className="hover:shadow-lg transition-shadow border-0 shadow-sm flex flex-col relative">
                    <Button 
                      onClick={() => handleConnectorAction(connector)}
                      disabled={connector.status !== 'available'}
                      variant="ghost"
                      size="icon"
                      className="absolute top-4 right-4 h-8 w-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full"
                    >
                     <Plus className="w-4 h-4" />
                    </Button>
                    <CardHeader>
                      <div className="flex items-center gap-3 pr-12">
                        <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center">
                          <IconComponent className={`w-6 h-6 ${connector.color}`} />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{connector.name}</CardTitle>
                          <Badge 
                            variant={connector.status === 'available' ? 'default' : 'secondary'}
                            className="mt-1"
                          >
                            {connector.status === 'available' ? (t('available') || 'Available') : (t('comingSoon') || 'Coming soon')}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-grow flex flex-col">
                      <p className="text-sm text-gray-600 mb-4 flex-grow">
                        {connector.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
