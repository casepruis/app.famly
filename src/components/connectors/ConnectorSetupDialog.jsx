import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, Check, AlertCircle, ExternalLink } from "lucide-react";

export default function ConnectorSetupDialog({ 
  isOpen, 
  onClose, 
  connector, 
  onConnect 
}) {
  const [setupStep, setSetupStep] = useState(1);
  const [config, setConfig] = useState({
    apiKey: '',
    webhook: '',
    syncFrequency: '15min',
    autoCreateTasks: true,
    notificationEmail: '',
    customSettings: {}
  });

  const handleConnect = async () => {
    // Simulate API call to backend
    try {
      const response = await fetch('/api/connectors/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connector_id: connector.id,
          config: config
        })
      });
      
      if (response.ok) {
        onConnect(connector.id, config);
        onClose();
      }
    } catch (error) {
      console.error('Connection failed:', error);
      // In real app, show error toast
    }
  };

  const getConnectorSpecificFields = () => {
    switch (connector && connector.id ? connector.id : '') {
      case 'gmail':
        return (
          <div className="space-y-4">
            <div>
              <Label>Gmail Integration Scope</Label>
              <Select value={config.scope} onValueChange={(value) => setConfig({...config, scope: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="readonly">Read emails only</SelectItem>
                  <SelectItem value="compose">Read and send emails</SelectItem>
                  <SelectItem value="full">Full Gmail access</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Auto-create tasks from emails with keywords</Label>
              <Input
                placeholder="urgent, todo, reminder, appointment"
                value={config.keywords}
                onChange={(e) => setConfig({...config, keywords: e.target.value})}
              />
            </div>
          </div>
        );
      case 'google-calendar':
        return (
          <div className="space-y-4">
            <div>
              <Label>Calendar Selection</Label>
              <Select value={config.calendar} onValueChange={(value) => setConfig({...config, calendar: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select calendar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary Calendar</SelectItem>
                  <SelectItem value="family">Family Calendar</SelectItem>
                  <SelectItem value="work">Work Calendar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      default:
        return (
          <div className="space-y-4">
            <div>
              <Label>API Key</Label>
              <Input
                type="password"
                placeholder="Enter your API key"
                value={config.apiKey}
                onChange={(e) => setConfig({...config, apiKey: e.target.value})}
              />
            </div>
          </div>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {connector && connector.icon && React.createElement(connector.icon, { 
              className: "w-5 h-5", 
              style: { color: connector.color } 
            })}
            Connect {connector && connector.name ? connector.name : 'Service'}
          </DialogTitle>
        </DialogHeader>

        {setupStep === 1 && (
          <div className="space-y-6">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900">Before you connect</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      You'll be redirected to {connector && connector.name ? connector.name : 'the service'} to authorize FamilySync to access your data.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div>
              <h4 className="font-medium mb-3">What FamilySync will access:</h4>
              <ul className="space-y-2">
                {connector && connector.features && connector.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={() => setSetupStep(2)} className="gap-2">
                Continue
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {setupStep === 2 && (
          <div className="space-y-6">
            <div>
              <h4 className="font-medium mb-4">Configure Integration</h4>
              
              {getConnectorSpecificFields()}
              
              <div className="mt-4">
                <Label>Sync Frequency</Label>
                <Select 
                  value={config.syncFrequency} 
                  onValueChange={(value) => setConfig({...config, syncFrequency: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5min">Every 5 minutes</SelectItem>
                    <SelectItem value="15min">Every 15 minutes</SelectItem>
                    <SelectItem value="1hour">Every hour</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="mt-4">
                <Label>Notification Email</Label>
                <Input
                  type="email"
                  placeholder="family@example.com"
                  value={config.notificationEmail}
                  onChange={(e) => setConfig({...config, notificationEmail: e.target.value})}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setSetupStep(1)}>Back</Button>
              <Button onClick={handleConnect} className="gap-2">
                <Check className="w-4 h-4" />
                Connect {connector && connector.name ? connector.name : 'Service'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}