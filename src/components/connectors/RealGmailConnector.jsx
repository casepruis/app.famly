import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Key, Terminal, Copy, ExternalLink, Shield } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const BACKEND_CODE_SNIPPET = `/*
  This is a placeholder for the backend code.
  The AI assistant will provide the full code for you to paste here.
  This function will securely handle Google OAuth and API calls.
*/
export default async function handler(req, res) {
  // Your real backend logic will go here
  res.status(200).json({ message: "Gmail processor ready." });
}`;

export default function RealGmailConnector({ onBack }) {

  const copyCode = () => {
    navigator.clipboard.writeText(BACKEND_CODE_SNIPPET);
  toast({ title: "Code Copied!", description: "The placeholder code has been copied to your clipboard.", duration: 5000  });
  };

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={onBack} className="gap-2">
        <ArrowLeft className="w-4 h-4" />
        Back to Connectors
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Key className="w-6 h-6 text-red-500" />
            <span className="text-2xl font-bold">Setup Real Gmail Connection</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-bold text-lg text-blue-800">Secure Backend Setup Required</h3>
            <p className="text-sm text-blue-700 mt-1">
              For your security, the connection to your personal Gmail account is handled by a backend function. Please follow these steps. The AI assistant is ready to provide the full code.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-lg">Step 1: Get Google Credentials</h4>
            <p className="text-sm text-gray-600">
              You need to get OAuth 2.0 credentials from the Google Cloud Console. This is how Google ensures that only your app can access your data.
            </p>
            <Button asChild variant="outline" size="sm">
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="gap-2">
                Go to Google Cloud Console <ExternalLink className="w-4 h-4" />
              </a>
            </Button>
            <p className="text-xs text-gray-500">
              You will need a `Client ID`, `Client Secret`, and `API Key`. Add these as secrets in your workspace settings.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-lg">Step 2: Create Backend Function</h4>
            <p className="text-sm text-gray-600">
              In your FamilySync workspace, go to the "Backend Functions" section and create a new function. Name it something like `gmailProcessor`.
            </p>
            <div className="bg-gray-900 text-white p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  <span className="text-sm font-semibold">gmailProcessor.js</span>
                </div>
                <Button variant="ghost" size="sm" onClick={copyCode} className="gap-1 text-white hover:bg-gray-700">
                  <Copy className="w-3 h-3" /> Copy Code
                </Button>
              </div>
              <pre className="text-xs overflow-x-auto">
                <code>{BACKEND_CODE_SNIPPET}</code>
              </pre>
            </div>
             <p className="text-sm text-gray-600">
              Ask the assistant for the "full backend code for Gmail" and paste it into this file. Once you deploy it, your connection will be live.
            </p>
          </div>
          
           <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4 flex items-start gap-3">
                 <Shield className="w-8 h-8 text-green-600 mt-1" />
                 <div>
                    <h4 className="font-medium text-green-900">Why this approach?</h4>
                    <p className="text-sm text-green-700 mt-1">
                       This method is highly secure. Your Google credentials are never exposed to the frontend. All communication with Google happens on your private backend, ensuring your data is safe.
                    </p>
                 </div>
              </CardContent>
           </Card>

        </CardContent>
      </Card>
    </div>
  );
}