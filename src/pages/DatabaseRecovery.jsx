
import React, { useState } from 'react';
import { User, FamilyMember } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import { grantAdminRights } from '@/api/functions';

export default function DatabaseRecovery() {
    const [isProcessing, setIsProcessing] = useState(false);
    const [isGrantingAdmin, setIsGrantingAdmin] = useState(false);
    const { toast } = useToast();
    const navigate = useNavigate();

    const handleReset = async () => {
        if (!window.confirm("Are you sure? This will disconnect you from any family and allow you to start the setup process again. You will be logged out.")) {
            return;
        }

        setIsProcessing(true);
        try {
            const user = await User.me();

            const memberProfiles = await FamilyMember.filter({ user_id: user.id });
            for (const profile of memberProfiles) {
                await FamilyMember.delete(profile.id);
            }

            await User.updateMyUserData({ family_id: null });

            toast({
                title: "Account Reset Successful",
                description: "Your family connection has been reset. Please log in again to start the setup.",
            });

            await User.logout();
            navigate(createPageUrl('Index'));

        } catch (error) {
            console.error("Error resetting account:", error);
            toast({
                title: "Error",
                description: "Could not reset your account. Please contact support.",
                variant: "destructive",
            });
            setIsProcessing(false);
        }
    };

    const handleGrantAdmin = async () => {
        if (!window.confirm("Are you sure you want to grant your account admin rights for your current family?")) {
            return;
        }

        setIsGrantingAdmin(true);
        try {
            const { data, status } = await grantAdminRights();
            
            if (status === 200 && data.success) {
                toast({
                    title: "Admin Rights Granted",
                    description: `You are now a family administrator for ${data.familyName || 'your family'}. Redirecting to Admin page.`,
                });

                // Small delay before redirect to allow toast to show
                setTimeout(() => {
                    navigate(createPageUrl('Admin'));
                }, 1500);
            } else {
                // Handle non-200 responses
                toast({
                    title: "Error",
                    description: data.error || "Could not grant admin rights. Please check console for details.",
                    variant: "destructive",
                });
                console.error('Grant admin error:', data);
            }

        } catch (error) {
            console.error("Error granting admin rights:", error);
            
            let errorMessage = "Could not grant admin rights.";
            if (error.response?.status === 403) {
                errorMessage = "Only the family creator can grant admin rights to themselves.";
            } else if (error.response?.status === 404) {
                errorMessage = "Family not found. Please contact support.";
            } else if (error.response?.data?.error) {
                errorMessage = error.response.data.error;
            }
            
            toast({
                title: "Error",
                description: errorMessage,
                variant: "destructive",
            });
        } finally {
            setIsGrantingAdmin(false);
        }
    };

    return (
        <div className="p-6 max-w-xl mx-auto space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <ShieldCheck className="w-6 h-6 text-blue-500" />
                        <CardTitle className="text-blue-700">Grant Admin Rights</CardTitle>
                    </div>
                    <CardDescription>
                        If you created your family but don't have access to the Admin page, use this tool to grant yourself admin rights.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-gray-700 mb-4">
                        This will assign the 'admin' role to your user account for your current family.
                    </p>
                    <Button 
                        className="w-full bg-blue-600 hover:bg-blue-700" 
                        onClick={handleGrantAdmin} 
                        disabled={isGrantingAdmin}
                    >
                        {isGrantingAdmin ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Granting...</>
                        ) : (
                            'Grant My Account Admin Rights'
                        )}
                    </Button>
                </CardContent>
            </Card>

            <Card className="border-red-500">
                <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <AlertTriangle className="w-6 h-6 text-red-500" />
                        <CardTitle className="text-red-700">Account Recovery Tool</CardTitle>
                    </div>
                    <CardDescription>
                        Use this tool only if your account is in a broken state (e.g., logged in but not part of a family).
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-gray-700">
                        Clicking the button below will:
                    </p>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                        <li>Disconnect your user from any family.</li>
                        <li>Delete your associated family member profile.</li>
                        <li>Log you out of the application.</li>
                    </ul>
                    <p className="text-sm text-gray-700">
                        After logging back in, you will be guided through the correct family setup process.
                    </p>
                    <Button 
                        variant="destructive" 
                        className="w-full" 
                        onClick={handleReset} 
                        disabled={isProcessing}
                    >
                        {isProcessing ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resetting...</>
                        ) : (
                            'Reset My Family Connection & Log Out'
                        )}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
