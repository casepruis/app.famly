
import React, { useState, useEffect } from "react";
import { useFamilyData } from "@/hooks/FamilyDataContext";
import { FamilyMember, User, Conversation, UserWhitelist, FamilyInvitation, Family } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import MemberDialog from "../components/familymembers/MemberDialog";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/components/common/LanguageProvider";
import { MoreHorizontal, Trash, Edit, Gift, MessageCircle, Bot, User as UserIcon, Mail, Plus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import Joyride from "../components/common/Joyride";
import { SendEmail } from "@/api/integrations";
// add alongside your other UI imports
import { Input } from "@/components/ui/input";


const membersTourSteps = [
    { target: '.member-card-0', title: 'Family Member Card', content: 'Each family member has a card with their name and role. You can edit details, remove members, or chat with them from here.' },
    { target: '.ai-assistant-card', title: 'AI Family Assistant', content: 'Your AI assistant is now part of the family! Give it a name and chat with it just like any other family member.' },
];

const availableColors = [
  '#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#FFBD33', '#8D33FF',
  '#33FFBD', '#A1FF33', '#5733FF', '#FF337A', '#33A1FF', '#7A33FF'
];

export default function FamilyMembers() {
  const { user, family, members, isLoading, reload } = useFamilyData();
  // Find the current user's member profile (if any)
  const currentUserMember = Array.isArray(members) && user ? members.find(m => m && m.user_id === user.id) : null;
  const [invitations, setInvitations] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [runTour, setRunTour] = useState(false);
  const [isEditingFamilyName, setIsEditingFamilyName] = useState(false);
  const [familyNameInput, setFamilyNameInput] = useState("");


  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    // Invitations are not in FamilyDataContext, so fetch them here
    async function fetchInvitations() {
      if (!user?.family_id) return setInvitations([]);
      const data = await FamilyInvitation.filter({ family_id: user.family_id, status: 'pending' }).catch(() => []);
      setInvitations(Array.isArray(data) ? data : []);
    }
    fetchInvitations();

    const handleAction = (event) => {
      const { action } = event.detail;
      if (action === 'new') handleAddNew();
      else if (action === 'tour') setRunTour(true);
    };
    window.addEventListener('actionTriggered', handleAction);
    const action = searchParams.get('action');
    if (action === 'new') { handleAddNew(); setSearchParams({}); }
    else if (action === 'tour') { setRunTour(true); setSearchParams({}); }
    return () => window.removeEventListener('actionTriggered', handleAction);
  }, [user, searchParams, setSearchParams]);



  const handleAddNew = () => {
    setEditingMember(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (member) => {
    setEditingMember(member);
    setIsDialogOpen(true);
  };

  const handleDelete = async (memberId) => {
    if (window.confirm(t('confirmDeleteMember') || 'Are you sure you want to delete this member?')) {
      try {
        await FamilyMember.delete(memberId);
        toast({ title: t('memberDeleted') || 'Member deleted', duration: 5000 });
          reload();
      } catch (error) {
        toast({ 
          title: t('error') || 'Error', 
          description: t('couldNotDeleteMember') || 'Could not delete member', 
          variant: "destructive" , 
          duration: 5000 
        });
      }
    }
  };

  // handleCancelInvitation is kept even if the UI element is removed
  const handleCancelInvitation = async (invitationId) => {
    if (window.confirm(t('confirmCancelInvitation') || 'Are you sure you want to cancel this invitation?')) {
      try {
        await FamilyInvitation.delete(invitationId);
        toast({ title: t('invitationCanceled') || 'Invitation canceled' });
          reload();
      } catch (error) {
        toast({ 
          title: t('error') || 'Error', 
          description: t('couldNotCancelInvitation') || 'Could not cancel invitation', 
          variant: "destructive" , 
          duration: 5000 
        });
      }
    }
  };

  const saveFamilyName = async () => {
  try {
    const user = await User.me();
    if (!user?.family_id) return;

    await Family.updateName(user.family_id, (familyNameInput || "").trim());
    reload();
    setIsEditingFamilyName(false);
    // optional toast
    // toast({ title: 'Family name updated' });
  } catch (e) {
    // optional toast
    // toast({ title: 'Error', description: 'Could not update family name', variant: 'destructive' });
    console.error("Failed to update family name:", e);
  }
};


const handleSave = async (memberData) => {
  try {
    const user = await User.me();

    // 🧼 Clean payload
  const cleaned = Object.fromEntries(
    Object.entries({
      ...memberData,
      dob: memberData.dob ? new Date(memberData.dob).toISOString().split("T")[0] : null,
    }).filter(([_, v]) => v !== undefined)
  );
    console.log("Saving:", editingMember);
    if (editingMember && editingMember.id) {
      console.log("Saving:", editingMember);
      await FamilyMember.update(editingMember.id, cleaned);
      toast({ title: t('memberUpdated') || 'Member updated', duration: 5000  });
    } else {
      await FamilyMember.create({
        ...cleaned,
        family_id: user.family_id,
      });
      toast({ title: t('memberAdded') || 'Member added', duration: 5000  });
    }

      reload();
    setIsDialogOpen(false);
  } catch (error) {
    console.error("❌ Save error:", error);
    toast({
      title: t('error') || 'Error',
      description: t('couldNotSaveMember') || 'Could not save member',
      variant: "destructive", 
      duration: 5000 
    });
  }
};



  const handleInvite = async (inviteData) => {
    try {
      const user = await User.me();
      
      // First add to whitelist
      await UserWhitelist.create({
        email: inviteData.email.toLowerCase(), // Normalize email
        added_by: user.email,
        status: 'active',
        notes: `Invited as ${inviteData.role} for ${inviteData.name}`
      });

      // Then send family invitation  
      await FamilyInvitation.create({
        email: inviteData.email,
        family_id: user.family_id,
        invited_by: user.email,
        status: 'pending'
      });

      // Create member profile that will be linked when they join
      await FamilyMember.create({
        name: inviteData.name,
        role: inviteData.role,
        family_id: user.family_id,
        pending_user_email: inviteData.email,
        color: availableColors[Math.floor(Math.random() * availableColors.length)]
      });

      toast({
        title: t('invitationSent') || 'Invitation sent',
        description: `${inviteData.email} has been invited and whitelisted.`,
        duration: 5000 
      });

        reload();
      setIsDialogOpen(false);
    } catch (error) {
      toast({ 
        title: t('error') || 'Error', 
        description: t('couldNotSendInvitation') || 'Could not send invitation', 
        variant: "destructive" , 
        duration: 5000 
      });
    }
  };

  const handleConnectEmail = async (member, email) => {
    // Determine if we are updating an existing invitation or sending a new one
    const hasPendingEmail = !!member.pending_user_email; // Check if the member currently has a pending email

    if (member.user_id) { // If the member is ALREADY connected to a user
      // Delegate to a new function that handles updating a connected member's email
      await handleUpdateConnectedEmail(member, email);
      return;
    }

    try {
      const user = await User.me();

      // If the email is the same as the current pending email, do nothing.
      if (hasPendingEmail && member.pending_user_email === email) {
        toast({
          title: t('noChangeNeeded') || 'No Change Needed',
          description: t('emailAlreadyPending') || 'This email is already pending for this member. No changes were made.',
          variant: "default", 
          duration: 5000 
        });
        setIsDialogOpen(false);
        return;
      }

      // If changing an existing pending email (i.e., hasPendingEmail is true and email is different)
      if (hasPendingEmail) {
        // Find and delete ALL old invitations for this email
        const oldInvitations = await FamilyInvitation.filter({ 
          email: member.pending_user_email, 
          family_id: user.family_id
        });
        
        // Delete all old invitations (not just pending ones)
        for (const invitation of oldInvitations) {
          await FamilyInvitation.delete(invitation.id);
        }
        console.log(`Deleted ${oldInvitations.length} old invitations for ${member.pending_user_email}`);
      }
      
      // Add new email to whitelist
      await UserWhitelist.create({
        email: email.toLowerCase(), // Normalize email
        added_by: user.email,
        status: 'active',
        notes: `Connected to existing member ${member.name}`
      });

      // Send new family invitation  
      await FamilyInvitation.create({
        email: email,
        family_id: user.family_id,
        invited_by: user.email,
        status: 'pending'
      });

      // Update member with new pending email
      await FamilyMember.update(member.id, {
        pending_user_email: email,
        name: member.name,
        role: member.role
      });

      toast({
        title: hasPendingEmail ? (t('invitationUpdated') || 'Invitation Updated') : (t('invitationSent') || 'Invitation Sent'),
        description: `${email} has been invited to connect to ${member.name}'s profile.`,
        duration: 5000 
      });

      loadMembers();
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error connecting email (for non-connected member):", error);
      toast({ 
        title: t('error') || 'Error', 
        description: hasPendingEmail ? (t('couldNotUpdateInvitation') || 'Could not update invitation') : (t('couldNotSendInvitation') || 'Could not send invitation'), 
        variant: "destructive" , 
        duration: 5000 
      });
    }
  };

  const handleUpdateConnectedEmail = async (member, newEmail) => {
    // Use member.user_id as the email directly
    const oldEmail = member.user_id;
    if (oldEmail === newEmail) {
      toast({ title: t('noChangeNeeded'), description: t('emailAlreadyConnected'), variant: 'default', duration: 5000  });
      return;
    }

    // Show a confirmation alert before changing the email (login)
    if (!window.confirm('Changing the email will change the login for this member. Are you sure you want to proceed?')) return;
    try {
      await FamilyMember.update(member.id, {
        ...member,
        user_id: newEmail // always set user_id to the email
      });
      toast({
        title: t('memberUpdated'),
        description: `Email updated to ${newEmail}.`,
        duration: 5000 
      });
      reload();
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error updating connected email:", error);
      toast({
        title: t('error'),
        description: t('couldNotUpdateInvitation'),
        variant: "destructive",
        duration: 5000 
      });
    }
  };

  const handleStartChat = async (otherMember) => {
  if (!currentUserMember) {
    toast({
      title: t('error') || 'Error',
      description: 'Cannot start chat - user profile not found',
      variant: "destructive",
      duration: 5000 
    });
    return;
  }

  try {
    // Ask backend to open existing DM or create if missing
    const conv = await Conversation.dm(otherMember.id);
    navigate(createPageUrl('Chat') + `?id=${conv.id}`);
  } catch (error) {
    console.error("Error starting member chat:", error);
    toast({
      title: t('error') || 'Error',
      description: 'Could not start chat',
      variant: "destructive",
      duration: 5000 
    });
  }
};


  const handleTourComplete = () => {
    setRunTour(false);
    localStorage.setItem('famly_tour_members_completed', 'true');
  };

  const handleResendInvitation = async (member) => {
    if (!member.pending_user_email || !family) {
      toast({ title: t('error') || 'Error', description: t('missingDataToSendInvitation') || 'Missing data to send invitation.', variant: "destructive", duration: 5000  });
      return;
    }

    // Show loading state
    toast({
      title: 'Sending Email...',
      description: `Preparing invitation for ${member.pending_user_email}`,
      duration: 5000 
    });

    try {
      const appUrl = window.location.origin;
      const loginUrl = `${appUrl}${createPageUrl('Index')}`;

      console.log('=== EMAIL DEBUG INFO ===');
      console.log('Attempting to send email to:', member.pending_user_email);
      console.log('Family name:', family.name);
      console.log('Login URL:', loginUrl);
      console.log('Member name:', member.name);

      const emailPayload = {
        to: member.pending_user_email,
        subject: `You're invited to join the ${family.name} family on famly.ai!`,
        body: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
            <h2 style="color: #3b82f6; text-align: center; margin-bottom: 25px;">You're invited to famly.ai!</h2>
            <p style="font-size: 16px; line-height: 1.5; color: #333333;">Hello ${member.name},</p>
            <p style="font-size: 16px; line-height: 1.5; color: #333333;">You've been invited to join the <strong>${family.name}</strong> family on famly.ai, a smart hub to manage schedules, tasks, and stay connected.</p>
            <p style="font-size: 16px; line-height: 1.5; color: #333333;">Please click below to get started:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px;">Join Your Family</a>
            </div>
            <p style="font-size: 14px; line-height: 1.5; color: #666666;">If the button doesn't work, copy and paste this link into your browser: <a href="${loginUrl}" style="color: #3b82f6; text-decoration: underline;">${loginUrl}</a></p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eeeeee;">
            <p style="font-size: 14px; color: #666666; text-align: center;">Thanks,<br/>The famly.ai Team</p>
          </div>
        `
      };

      console.log('Email payload:', JSON.stringify(emailPayload, null, 2));

      const emailResult = await SendEmail(emailPayload);

      console.log('=== EMAIL RESULT ===');
      console.log('Success! Email result:', emailResult);

      toast({
        title: t('invitationSent') || 'Invitation Sent Successfully!',
        description: `Email sent to ${member.pending_user_email}. They should receive it shortly.`,
        duration: 5000 
      });

    } catch (error) {
      console.error('=== EMAIL ERROR ===');
      console.error('Failed to send invitation:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }

      toast({ 
        title: 'Email Send Failed', 
        description: `Failed to send email to ${member.pending_user_email}. Error: ${error.message}`, 
        variant: "destructive" , 
        duration: 5000 
      });
    }
  };

  // Ensure members is always an array and safely filter
  const safeMembers = Array.isArray(members) ? members : [];
  const regularMembers = safeMembers.filter(m => m && m.role !== 'ai_assistant');
  const aiMembers = safeMembers.filter(m => m && m.role === 'ai_assistant');

  if (isLoading) {
    return <div className="p-6 text-center">{t('loading') || 'Loading'}...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
        <Joyride steps={membersTourSteps} run={runTour} onComplete={handleTourComplete} />
        {/* Family name header / editor */}
<div className="mb-8 p-4 bg-white rounded-xl shadow-sm border">
  <div className="flex items-center justify-between gap-4">
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Family name</p>
      {!isEditingFamilyName ? (
        <h1 className="text-2xl font-bold text-gray-900">{family?.name || "—"}</h1>
      ) : (
        <div className="flex items-center gap-3">
          <Input
            value={familyNameInput}
            onChange={(e) => setFamilyNameInput(e.target.value)}
            placeholder="Your family name"
            className="max-w-xs"
          />
          <Button size="sm" onClick={saveFamilyName}>Save</Button>
          <Button size="sm" variant="outline" onClick={() => { setIsEditingFamilyName(false); setFamilyNameInput(family?.name || ""); }}>
            Cancel
          </Button>
        </div>
      )}
    </div>

    {!isEditingFamilyName ? (
      <Button size="sm" variant="outline" onClick={() => setIsEditingFamilyName(true)}>
        <Edit className="mr-2 h-4 w-4" />
        Edit
      </Button>
    ) : null}
  </div>
</div>

        <div className="space-y-8">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-blue-500" />
                {t('familyMembers') || 'Family Members'}
              </h2>
              <Button onClick={handleAddNew} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                {t('addMember') || 'Add Member'}
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {regularMembers.map((member, index) => (
                    <motion.div
                      key={member.id || member.email || member.name || Math.random()}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className={`member-card-${index} bg-white rounded-xl shadow-sm border p-6 text-center hover:shadow-md transition-shadow flex flex-col`}
                    >
                      <div className="w-20 h-20 rounded-full mx-auto mb-4" style={{ backgroundColor: member.color || '#e0e0e0' }}>
                        <span className="flex items-center justify-center h-full text-3xl font-bold text-white">
                          {member.name ? member.name.charAt(0) : '?'}
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 text-lg">{member.name || 'Unknown'}</h3>
                      <p className="text-sm text-gray-500 capitalize mb-2">{t(member.role) || member.role || 'Unknown'}</p>

                      {/* Show connection status and email */}
                      <div className="mb-3 min-h-[36px] flex flex-col justify-center items-center">
                        {member.user_id ? (
                          <>
                            <div className="flex items-center justify-center gap-1.5 py-1 px-2 bg-green-50 rounded-full border border-green-200">
                              <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                              <span className="text-xs text-green-700 font-medium">{t('connected') || 'Connected'}</span>
                            </div>
                            {member.user_id && (
                              <span className="text-xs text-gray-600 mt-1 break-all">{member.user_id}</span>
                            )}
                          </>
                        ) : member.pending_user_email ? (
                          <>
                            <div className="flex items-center justify-center gap-1.5 py-1 px-2 bg-orange-50 rounded-full border border-orange-200">
                              <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></div>
                              <span className="text-xs text-orange-700 font-medium">{t('invitationPending') || 'Invitation Pending'}</span>
                            </div>
                            <span className="text-xs text-gray-600 mt-1 break-all">{member.pending_user_email}</span>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center justify-center gap-1.5 py-1 px-2 bg-gray-100 rounded-full border border-gray-200">
                              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                              <span className="text-xs text-gray-600 font-medium">{t('localOnly') || 'Local Only'}</span>
                            </div>
                            {member.user_id && (
                              <span className="text-xs text-gray-600 mt-1 break-all">{member.user_id}</span>
                            )}
                          </>
                        )}
                      </div>

                      <div className="mt-auto space-y-2">
                         <Button variant="outline" size="sm" className="w-full text-sm" onClick={() => handleStartChat(member)}>
                            <MessageCircle className="mr-2 h-4 w-4" />
                            {t('chat') || 'Chat'}
                         </Button>
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="w-full text-gray-500">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => handleEdit(member)}>
                                <Edit className="mr-2 h-4 w-4" />
                                {t('edit') || 'Edit'}
                              </DropdownMenuItem>
                              {member.pending_user_email && (
                                <DropdownMenuItem onClick={() => handleResendInvitation(member)}>
                                  <Mail className="mr-2 h-4 w-4" />
                                  {t('resendInvitation') || 'Resend Invitation'}
                                
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => navigate(createPageUrl(`Wishlist?memberId=${member.id}`))}>
                                <Gift className="mr-2 h-4 w-4" />
                                {t('wishlist') || 'Wishlist'}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDelete(member.id)} className="text-red-600 focus:text-red-700 focus:bg-red-50">
                                <Trash className="mr-2 h-4 w-4" />
                                {t('delete') || 'Delete'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                      </div>
                    </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
          
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Bot className="w-5 h-5 text-indigo-500" />
              {t('aiAssistant') || 'AI Assistant'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {aiMembers.map((member) => (
                <motion.div
                  key={member.id || member.email || member.name || Math.random()}
                  layout
                  className="ai-assistant-card relative bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl shadow-sm border border-indigo-200 p-6 text-center hover:shadow-md transition-all flex flex-col"
                >
                  <div className="w-20 h-20 rounded-full mx-auto mb-4 bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center">
                    <Bot className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900 text-lg">{member.name || 'AI Assistant'}</h3>
                  <p className="text-sm text-indigo-600 mb-4">{t('aiAssistant') || 'AI Assistant'}</p>
                   <div className="mt-auto space-y-2">
                       <Button variant="outline" size="sm" className="w-full text-sm" onClick={() => handleStartChat(member)}>
                          <MessageCircle className="mr-2 h-4 w-4" />
                          {t('chat') || 'Chat'}
                       </Button>
                       <Button variant="ghost" size="sm" className="w-full text-gray-500" onClick={() => handleEdit(member)}>
                          <Edit className="mr-2 h-4 w-4" />
                          {t('editName') || 'Edit Name'}
                       </Button>
                    </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

    <MemberDialog
      isOpen={isDialogOpen}
      onClose={() => setIsDialogOpen(false)}
      onSave={handleSave}
      onInvite={handleInvite}
      onConnectEmail={handleConnectEmail}
      member={editingMember}
      // Pass a prop to auto-fill name from email connection
      autoFillNameFromEmail
    />
    </div>
  );
}
