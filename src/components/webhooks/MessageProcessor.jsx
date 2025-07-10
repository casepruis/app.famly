import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Smartphone, MessageSquare, Zap, Copy, CheckCircle2 } from "lucide-react";
import { InvokeLLM } from "@/api/integrations";
import { Task, ScheduleEvent, FamilyMember } from "@/api/entities";

export default function MessageProcessor() {
  const [webhookUrl, setWebhookUrl] = useState('https://api.famly.ai/webhook/whatsapp');
  const [testMessage, setTestMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [recentMessages, setRecentMessages] = useState([]);

  const processIncomingMessage = async (messageText, sender = 'WhatsApp User') => {
    setIsProcessing(true);
    
    try {
      const familyMembers = await FamilyMember.list();
      const familyContext = familyMembers.map(m => 
        `${m.name} (${m.role}, age ${m.age}, ID: ${m.id})`
      ).join(', ') || 'No family members defined';

      const result = await InvokeLLM({
        prompt: `You are FamilySync AI processing a message from a family member via WhatsApp.

        Family Context: ${familyContext}
        
        Message received: "${messageText}"
        Sender: ${sender}

        Analyze this message and determine if the person wants to:
        1. Create a task/chore for someone
        2. Schedule an event or appointment  
        3. Set a reminder
        4. Ask about family schedule
        5. Just casual conversation

        If it's a task or event request, extract all relevant details.
        Be smart about inferring context - if they say "remind me to pick up groceries tomorrow at 3pm", that's both a task and an event.

        Response should be conversational like you're texting back.`,
        
        response_json_schema: {
          type: "object",
          properties: {
            intent: {
              type: "string",
              enum: ["create_task", "create_event", "create_both", "query", "casual", "unclear"]
            },
            response_message: { 
              type: "string",
              description: "Friendly response to send back via WhatsApp"
            },
            task_data: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                category: { type: "string" },
                priority: { type: "string" },
                assigned_to: { type: "string" },
                due_date: { type: "string" },
                points: { type: "number" }
              }
            },
            event_data: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                start_time: { type: "string" },
                end_time: { type: "string" },
                category: { type: "string" },
                location: { type: "string" },
                family_member_ids: { type: "array", items: { type: "string" } }
              }
            }
          },
          required: ["intent", "response_message"]
        }
      });

      // Process the AI response and create tasks/events
      let createdItems = [];

      if ((result.intent === 'create_task' || result.intent === 'create_both') && result.task_data) {
        const assignedMember = familyMembers.find(m => 
          m.name.toLowerCase().includes(result.task_data.assigned_to?.toLowerCase() || '') ||
          result.task_data.assigned_to === m.id
        ) || familyMembers[0];

        const task = await Task.create({
          ...result.task_data,
          assigned_to: assignedMember?.id,
          ai_suggested: true,
          source: 'whatsapp_webhook',
          due_date: result.task_data.due_date ? new Date(result.task_data.due_date).toISOString() : null
        });
        
        createdItems.push(`Task: ${task.title}`);
      }

      if ((result.intent === 'create_event' || result.intent === 'create_both') && result.event_data) {
        let memberIds = [];
        if (result.event_data.family_member_ids) {
          memberIds = result.event_data.family_member_ids
            .map(nameOrId => familyMembers.find(m => 
              m.name.toLowerCase().includes(nameOrId.toLowerCase()) ||
              m.id === nameOrId
            )?.id)
            .filter(Boolean);
        }

        const event = await ScheduleEvent.create({
          ...result.event_data,
          family_member_ids: memberIds,
          ai_suggested: true,
          source: 'whatsapp_webhook',
          start_time: result.event_data.start_time ? new Date(result.event_data.start_time).toISOString() : new Date().toISOString(),
          end_time: result.event_data.end_time ? new Date(result.event_data.end_time).toISOString() : new Date(Date.now() + 60*60*1000).toISOString()
        });
        
        createdItems.push(`Event: ${event.title}`);
      }

      const messageRecord = {
        id: Date.now(),
        sender,
        message: messageText,
        response: result.response_message,
        intent: result.intent,
        created_items: createdItems,
        timestamp: new Date()
      };

      setRecentMessages(prev => [messageRecord, ...prev.slice(0, 9)]);

      return {
        success: true,
        response: result.response_message,
        created: createdItems
      };

    } catch (error) {
      console.error('Message processing error:', error);
      return {
        success: false,
        response: "Sorry, I couldn't process that message right now. Please try again later.",
        error: error.message
      };
    } finally {
      setIsProcessing(false);
    }
  };

  const testWebhookMessage = async () => {
    if (!testMessage.trim()) return;
    
    const result = await processIncomingMessage(testMessage, 'Test User');
    console.log('Test result:', result);
    setTestMessage('');
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
  };

  return (
    <div className="space-y-6">
      {/* Webhook Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-green-500" />
            WhatsApp Integration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Webhook URL</Label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="flex-1" />
              <Button variant="outline" size="sm" onClick={copyWebhookUrl}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Configure this URL in your WhatsApp Business API or messaging platform
            </p>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">How it works:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Forward WhatsApp messages to the webhook URL</li>
              <li>• AI automatically detects tasks, events, and reminders</li>
              <li>• Creates entries in FamilySync and responds via WhatsApp</li>
              <li>• Supports natural language like "remind me to pick up kids at 3pm"</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Test Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-500" />
            Test Message Processing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Test Message</Label>
            <div className="flex gap-2">
              <Input
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="e.g., 'Remind Max to do homework by 6pm tomorrow'"
                className="flex-1"
              />
              <Button 
                onClick={testWebhookMessage} 
                disabled={isProcessing || !testMessage.trim()}
                className="gap-2"
              >
                <Zap className="w-4 h-4" />
                Process
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Messages */}
      {recentMessages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Processed Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentMessages.map((msg) => (
                <div key={msg.id} className="border rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{msg.sender}</Badge>
                      <Badge className={
                        msg.intent === 'create_task' ? 'bg-blue-100 text-blue-800' :
                        msg.intent === 'create_event' ? 'bg-green-100 text-green-800' :
                        msg.intent === 'create_both' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }>
                        {msg.intent}
                      </Badge>
                    </div>
                    <span className="text-xs text-gray-500">
                      {msg.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-medium text-gray-700">Message: </span>
                      <span className="text-sm">{msg.message}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Response: </span>
                      <span className="text-sm text-green-700">{msg.response}</span>
                    </div>
                    {msg.created_items.length > 0 && (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-700">
                          Created: {msg.created_items.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}