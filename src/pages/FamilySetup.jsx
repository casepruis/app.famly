
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Family, FamilyMember, FamilyInvitation } from '@/api/entities';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Home, Users, Sparkles, Loader2, AlertCircle } from 'lucide-react';

export default function FamilySetup() {
  const [familyData, setFamilyData] = useState({ name: '', language: 'en' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Prevent multiple simultaneous initializations
    let initializationInProgress = false; // This variable persists across renders due to closure, but resets on unmount/remount
    
    const initialize = async () => {
      if (initializationInProgress) {
        console.log("Initialization already in progress, skipping...");
        return;
      }
      
      initializationInProgress = true;
      setIsLoading(true);
      setError(null);

      try {
        const currentUser = await User.me();
        setUser(currentUser);

        // Safeguard: If user is already part of a family, redirect them.
        if (currentUser.family_id) {
          console.log("User already has family_id:", currentUser.family_id, "- redirecting to dashboard");
          navigate(createPageUrl("Dashboard"));
          return;
        }

        // --- INVITATION CONNECTION LOGIC ---
        // Check if the user was invited to an existing family.
        const pendingMembers = await FamilyMember.filter({ pending_user_email: currentuser.user_id });
        
        if (pendingMembers.length > 0) {
          const memberProfile = pendingMembers[0];
          const targetFamilyId = memberProfile.family_id;

          if (targetFamilyId) {
            console.log(`Found pending profile. Connecting to family ID: ${targetFamilyId}`);
            
            // Verify the target family exists before connecting
            try {
              const targetFamily = await Family.get(targetFamilyId);
              if (!targetFamily) {
                console.error("Target family not found, cleaning up pending member");
                if (memberProfile.id) { // Ensure ID exists before attempting delete
                  await FamilyMember.delete(memberProfile.id);
                }
                throw new Error("Invited family no longer exists");
              }
            } catch (familyError) {
              console.error("Error verifying target family:", familyError);
              // Clean up the invalid pending member
              if (memberProfile.id) { // Ensure ID exists before attempting delete
                await FamilyMember.delete(memberProfile.id);
              }
              throw new Error("Could not verify invited family");
            }
            
            // Update the User with the family_id
            await User.updateMyUserData({ family_id: targetFamilyId });
            
            // Link the FamilyMember profile to the user
            await FamilyMember.update(memberProfile.id, {
              user_id: currentUser.id,
              pending_user_email: null
            });
            
            toast({ title: "Connection Successful!", description: `Welcome, ${memberProfile.name}! Redirecting...` , duration: 5000 });
            navigate(createPageUrl("Dashboard"));
            return;
          }
        }
        
        // If no family and no pending invitation, show the creation form.
        console.log("No family or pending invitations found. Showing setup form.");
        setIsLoading(false);
        
      } catch (err) {
        console.error('Error during FamilySetup initialization:', err);
        if (err.response?.status === 429) {
          setError('Too many requests. Please wait a moment and refresh the page.');
        } else {
          setError(`Could not verify your family status: ${err.message}. Please refresh the page.`);
        }
        setIsLoading(false);
      } finally {
        initializationInProgress = false;
      }
    };

    // Add a small delay to prevent rapid successive calls and race conditions
    const timer = setTimeout(initialize, 500);
    return () => {
      clearTimeout(timer);
      initializationInProgress = false; // Reset on cleanup
    };
    
  }, [navigate, toast]);

  const handleCreateFamily = async (e) => {
    e.preventDefault();
    if (!user) {
        toast({ title: "Error", description: "User session not found. Please log in again.", variant: "destructive", duration: 5000  });
        return;
    }

    // Prevent double submissions
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
        console.log("Attempting to create family with data:", familyData);
        
        // Check if user already has a family (safety check)
        const currentUser = await User.me();
        if (currentUser.family_id) {
            console.log("User already has family_id:", currentUser.family_id);
            toast({ title: "Error", description: "You already belong to a family. Redirecting...", variant: "destructive", duration: 5000  });
            navigate(createPageUrl("Dashboard"));
            return;
        }
        
        // Create family with unique constraint checking
        const newFamily = await Family.create({
            ...familyData,
            created_by: user.user_id // Add creator tracking
        });
        console.log("Family created:", newFamily);
        
        // Verify family was created successfully before proceeding
        if (!newFamily || !newFamily.id) {
            throw new Error("Family creation failed - no ID returned");
        }
        
        // Create the member profile for the current user (as parent/admin)
        const adminMemberData = {
            name: user.full_name || 'Admin',
            role: 'parent',
            family_id: newFamily.id,
            user_id: user.id,
            color: '#3b82f6' // A nice default blue for the admin
        };
        console.log("Creating admin member with data:", adminMemberData);
        const adminMember = await FamilyMember.create(adminMemberData);
        
        if (!adminMember || !adminMember.id) {
            throw new Error("Admin member creation failed");
        }
        
        // Create the AI assistant member by default
        const aiMemberData = {
            name: "AI Assistent",
            role: "ai_assistant",
            family_id: newFamily.id,
            color: '#6366f1' // A nice default indigo for the AI
        };
        console.log("Creating AI member with data:", aiMemberData);
        const aiMember = await FamilyMember.create(aiMemberData);
        
        if (!aiMember || !aiMember.id) {
            console.warn("AI member creation failed, but continuing...");
        }

        // Update the user's record with the new family_id and set them as an admin
        console.log("Updating user with family_id and admin role:", newFamily.id);
        await User.updateMyUserData({ family_id: newFamily.id, role: 'admin' });

        // Verify the update was successful
        const updatedUser = await User.me();
        if (updatedUser.family_id !== newFamily.id) {
            throw new Error("Failed to update user's family_id");
        }

        toast({
            title: "Family Hub Created!",
            description: "Redirecting you to your new dashboard...",
            duration: 5000 
        });

        // Small delay to ensure all database operations are complete
        setTimeout(() => {
            navigate(createPageUrl("Dashboard"));
        }, 1000);

    } catch (err) {
        console.error('Error creating family:', err);
        console.error('Error details:', err.response?.data || err.message);
        
        // If family was partially created, try to clean up
        if (err.message.includes("already exists") || err.response?.status === 409) {
            toast({ 
                title: "Duplicate Family", 
                description: "A family with this name already exists. Please choose a different name.", 
                variant: "destructive" ,
                duration: 5000 
            });
        } else {
            toast({ 
                title: "Error", 
                description: `Could not create family: ${err.message || 'Unknown error'}. Please try again.`, 
                variant: "destructive" ,
                duration: 5000 
            });
        }
    } finally {
        setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
        <div className="w-full h-screen flex flex-col items-center justify-center bg-gray-50">
            <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
            <p className="text-xl font-semibold text-gray-700">Verifying your connection...</p>
        </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-xl w-full shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle className="text-3xl font-bold text-red-700">Error</CardTitle>
            <CardDescription className="text-lg text-red-600 pt-2">
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => window.location.reload()} className="mt-4">
              <Sparkles className="mr-2 h-5 w-5" /> Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-xl w-full">
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Home className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle className="text-3xl font-bold">Create your new family hub</CardTitle>
            <CardDescription className="text-lg text-gray-600 pt-2">
              Let's set up your private space to manage schedules, tasks, and stay connected.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateFamily} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="familyName" className="text-sm font-medium text-gray-700">Family Name</label>
                <Input 
                  id="familyName"
                  type="text" 
                  placeholder="e.g., The Millers, The Super Fam"
                  value={familyData.name}
                  onChange={(e) => setFamilyData({ ...familyData, name: e.target.value })}
                  required 
                  className="text-base p-4"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="language" className="text-sm font-medium text-gray-700">Default Language</label>
                <Select value={familyData.language} onValueChange={(value) => setFamilyData({ ...familyData, language: value })}>
                  <SelectTrigger className="text-base p-4">
                    <SelectValue placeholder="Select a language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                    <SelectItem value="nl">Nederlands</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={isProcessing} className="w-full text-lg py-6 bg-blue-600 hover:bg-blue-700">
                {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
                Create Family Hub
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
