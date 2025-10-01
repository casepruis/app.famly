import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Copy, Smartphone, MessageSquare, Zap, Send, Settings } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { InvokeLLM } from "@/api/integrations";

export default function MessageProcessor() {
  const [webhookUrl, setWebhookUrl] = useState("https://api.famly.ai/webhook/message");
  const [testMessage, setTestMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [recentMessages, setRecentMessages] = useState([
    {
      id: 1,
      message: "Pick up groceries at 3pm tomorrow",
      processed: "Created task: 'Pick up groceries' due tomorrow at 3:00 PM",
      timestamp: "2 hours ago",
      source: "WhatsApp"
    },
    {
      id: 2,
      message: "Emma has piano lesson Wednesday 4pm",
      processed: "Created event: 'Piano lesson' for Emma on Wednesday at 4:00 PM",
      timestamp: "1 day ago",
      source: "WhatsApp"
    }
  ]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Webhook URL has been copied to your clipboard.", 
      duration: 5000 
    });
  };

  const processTestMessage = async () => {
    if (!testMessage.trim()) return;
    
    setIsProcessing(true);
    try {
      const result = await InvokeLLM({
        prompt: `You are FamilySync AI processing a family message. 
        
        Message: "${testMessage}"
        
        Analyze this message and determine if it contains:
        1. A task request (chores, reminders, to-dos)
        2. An event/appointment (meetings, activities, appointments)
        3. A question about schedule
        4. General family communication
        
        If it's a task or event, extract the relevant details.`,
        
        response_json_schema: {
          type: "object",
          properties: {
            intent: {
              type: "string",
              enum: ["create_task", "create_event", "query_schedule", "general"]
            },
            processed_text: {
              type: "string",
              description: "What FamilySync would do with this message"
            },
            confidence: {
              type: "number",
              description: "Confidence level 0-1"
            }
          },
          required: ["intent", "processed_text"]
        }
      });

      const newMessage = {
        id: Date.now(),
        message: testMessage,
        processed: result.processed_text,
        timestamp: "Just now",
        source: "Test"
      };

      setRecentMessages(prev => [newMessage, ...prev.slice(0, 4)]);
      setTestMessage("");
      
      toast({
        title: "Message Processed",
        description: "Your test message has been processed successfully."
      });
    } catch (error) {
      console.error('Message processing error:', error);
      toast({
        title: "Processing Failed",
        description: "There was an error processing your message.",
        variant: "destructive",
        duration: 5000 
      });
    }
    setIsProcessing(false);
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Message Integration</h2>
        <p className="text-gray-600">
          Connect WhatsApp, SMS, or other messaging services to automatically create tasks and events
        </p>
      </div>

      {/* Webhook Setup */}
      <Card className="border-2 border-dashed border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-blue-600" />
            Webhook URL Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Your Webhook URL</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={webhookUrl}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(webhookUrl)}
                className="gap-1"
              >
                <Copy className="w-4 h-4" />
                Copy
              </Button>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Use this URL in your WhatsApp Business API, Zapier, or other automation tools
            </p>
          </div>

          <div className="bg-white p-4 rounded-lg border">
            <h4 className="font-medium mb-2">How to connect WhatsApp:</h4>
            <ol className="text-sm text-gray-600 space-y-1">
              <li>1. Set up WhatsApp Business API or use a service like Zapier</li>
              <li>2. Configure webhook to forward messages to the URL above</li>
              <li>3. Include sender information in the webhook payload</li>
              <li>4. FamilySync will automatically process and create tasks/events</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Test Message */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-green-600" />
            Test Message Processing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Test Message</Label>
            <Textarea
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="Type a message like: 'Pick up dry cleaning tomorrow at 2pm' or 'Schedule dentist appointment for Emma next Friday'"
              rows={3}
            />
          </div>
          <Button
            onClick={processTestMessage}
            disabled={!testMessage.trim() || isProcessing}
            className="gap-2"
          >
            <Send className="w-4 h-4" />
            {isProcessing ? 'Processing...' : 'Test Process'}
          </Button>
        </CardContent>
      </Card>

      {/* Recent Messages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-600" />
            Recent Processed Messages
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentMessages.length > 0 ? (
            <div className="space-y-4">
              {recentMessages.map((msg) => (
                <div key={msg.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <Badge variant="outline">{msg.source}</Badge>
                    <span className="text-xs text-gray-500">{msg.timestamp}</span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-medium text-gray-700">Original:</span>
                      <p className="text-sm text-gray-900">"{msg.message}"</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Processed:</span>
                      <p className="text-sm text-green-700">✓ {msg.processed}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No messages processed yet</p>
              <p className="text-sm">Test the feature above to see how it works</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Integration Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Examples</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Task Creation</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <p>• "Buy milk tomorrow"</p>
                <p>• "Remind John to walk the dog at 6pm"</p>
                <p>• "Schedule house cleaning this Saturday"</p>
              </div>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Event Scheduling</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <p>• "Emma has soccer practice Tuesday 4pm"</p>
                <p>• "Family dinner Sunday at 6:30"</p>
                <p>• "Doctor appointment for Max next Friday 2pm"</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}