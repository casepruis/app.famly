import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { normalizeWhitelistEmails } from '@/api/functions';
import { Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function DataCleanup() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const { toast } = useToast();

  const handleCleanup = async () => {
    setIsLoading(true);
    setResult(null);
    try {
      const { data, error } = await normalizeWhitelistEmails();
      
      if (error) {
        throw new Error(error.message || 'An unknown error occurred.');
      }

      setResult({ success: true, message: data.message });
      toast({
        title: 'Success!',
        description: data.message,
        duration: 5000 
      });

    } catch (err) {
      setResult({ success: false, message: `Cleanup failed: ${err.message}` });
      toast({
        title: 'Error',
        description: `Cleanup failed: ${err.message}`,
        variant: 'destructive',
        duration: 5000 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Whitelist Data Normalization</CardTitle>
          <CardDescription>
            This tool will scan the user whitelist and convert all email addresses to lowercase to prevent authentication issues related to case sensitivity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-gray-600">
              Click the button below to start the cleanup process. This should only need to be run once.
            </p>
            <Button onClick={handleCleanup} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Normalize Whitelist Emails'
              )}
            </Button>
            {result && (
              <div className={`mt-4 p-4 rounded-md w-full text-center ${result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                {result.success ? <ShieldCheck className="mx-auto mb-2 h-6 w-6" /> : <AlertTriangle className="mx-auto mb-2 h-6 w-6" />}
                <p className="font-semibold">{result.message}</p>
              </div>
            )}
            <Link to={createPageUrl('PlatformAdmin')}>
                <Button variant="link">Back to Platform Admin</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}