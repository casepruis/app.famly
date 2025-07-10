import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Play, Settings, Zap } from "lucide-react";

export default function ConnectorFlow({ flows, onCreateFlow, onEditFlow, onRunFlow }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Automation Flows</h3>
        <Button onClick={onCreateFlow} className="gap-2">
          <Zap className="w-4 h-4" />
          Create Flow
        </Button>
      </div>

      {flows.length === 0 ? (
        <Card className="border-dashed border-2 border-gray-300">
          <CardContent className="p-8 text-center">
            <Zap className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h4 className="text-lg font-semibold text-gray-600 mb-2">No Automation Flows Yet</h4>
            <p className="text-gray-500 mb-4">
              Create automated workflows to connect your family apps and save time.
            </p>
            <Button onClick={onCreateFlow} className="gap-2">
              <Zap className="w-4 h-4" />
              Create Your First Flow
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {flows.map((flow, index) => (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{flow.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={flow.active ? "default" : "secondary"}>
                      {flow.active ? "Active" : "Inactive"}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => onEditFlow(flow)}>
                      <Settings className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <flow.trigger.icon className="w-5 h-5" style={{ color: flow.trigger.color }} />
                    <span className="text-sm font-medium">{flow.trigger.name}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                  <div className="flex items-center gap-2">
                    <flow.action.icon className="w-5 h-5" style={{ color: flow.action.color }} />
                    <span className="text-sm font-medium">{flow.action.name}</span>
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 mb-4">{flow.description}</p>
                
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">
                    Last run: {flow.lastRun || 'Never'}
                  </span>
                  <Button size="sm" onClick={() => onRunFlow(flow)} className="gap-1">
                    <Play className="w-3 h-3" />
                    Test Run
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}