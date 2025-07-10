import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Check } from "lucide-react";
import { useLanguage } from "@/components/common/LanguageProvider";

export default function ConnectorCard({ connector, isConnected, onConnect, onDisconnect, onConfigure }) {
  const { t } = useLanguage();
  const Icon = connector.icon;

  return (
    <Card className="h-full transition-all duration-200 hover:shadow-md border-gray-200 bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
              style={{ backgroundColor: connector.color }}
            >
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-gray-900">{connector.name}</CardTitle>
              <Badge variant="outline" className="text-xs mt-1">{connector.category}</Badge>
            </div>
          </div>
          {isConnected && (
            <div className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-full">
              <Check className="w-3 h-3" />
              <span className="text-xs font-medium">{t('connected') || 'Connected'}</span>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <p className="text-sm text-gray-600 mb-4 leading-relaxed">
          {connector.description}
        </p>
        
        <div className="flex gap-2">
          {isConnected ? (
            <>
              <Button 
                size="sm" 
                variant="outline"
                onClick={onConfigure}
                className="flex-1"
              >
                <Settings className="w-4 h-4 mr-1" />
                {t('configure') || 'Configure'}
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={onDisconnect}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                {t('disconnect') || 'Disconnect'}
              </Button>
            </>
          ) : (
            <Button 
              size="sm" 
              variant="outline"
              onClick={onConnect}
              className="w-full"
            >
              {t('connect') || 'Connect'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}