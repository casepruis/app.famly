
import React, { useState, useEffect } from "react";
import { FamilyMember, User, Conversation, UserWhitelist, FamilyInvitation, Family } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import MemberDialog from "../components/familymembers/MemberDialog";
import { useToast } from "@/components/ui/use-toast";
import { useLanguage } from "@/components/common/LanguageProvider";
import { MoreHorizontal, Trash, Edit, Gift, MessageCircle, Bot, User as UserIcon, Mail } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import Joyride from "../components/common/Joyride";
import { SendEmail } from "@/api/integrations";

const membersTourSteps = [
    { target: '.member-card-0', title: 'Family Member Card', content: 'Each family member has a card with their name and role. You can edit details, remove members, or chat with them from here.' },
    { target: '.ai-assistant-card', title: 'AI Family Assistant', content: 'Your AI assistant is now part of the family! Give it a name and chat with it just like any other family member.' },
];

const availableColors = [
  '#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#FFBD33', '#8D33FF',
  '#33FFBD', '#A1FF33', '#5733FF', '#FF337A', '#33A1FF', '#7A33FF'
];

export default function FamilyMembers() {
  const [members, setMembers] = useState([]);
  const [currentUserMember, setCurrentUserMember] = useState(null);
  const [family, setFamily] = useState(null); // Added family state
  const [invitations, setInvitations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [runTour, setRunTour] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    loadMembers();
    
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
  }, [searchParams, setSearchParams]);

  const loadMembers = async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      if (!user?.family_id) {
        navigate(createPageUrl("Index"));
        return;
      }
      
      const [membersData, invitationsData, familyData] = await Promise.all([
        FamilyMember.filter({ family_id: user.family_id }, 'created_date'),
        FamilyInvitation.filter({ family_id: user.family_id, status: 'pending' }).catch(() => []),
        Family.get(user.family_id).catch(() => null)
      ]);
      
      // Ensure membersData is an array
      const safeMembers = Array.isArray(membersData) ? membersData : [];
      const safeInvitations = Array.isArray(invitationsData) ? invitationsData : [];
      
      const loggedInMember = safeMembers.find(m => m.user_id === user.id);
      setCurrentUserMember(loggedInMember);
      
      setMembers(safeMembers);
      setInvitations(safeInvitations);
      setFamily(familyData); // Set family data
    } catch (error) {
      console.error("Error loading family members:", error);
      toast({
        title: t('error') || 'Error',
        description: t('couldNotLoadMembers') || 'Could not load family members',
        variant: "destructive"
      });
      setMembers([]);
      setInvitations([]);
      setFamily(null); // Clear family data on error
    }
    setIsLoading(false);
  };

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
        toast({ title: t('memberDeleted') || 'Member deleted' });
        loadMembers();
      } catch (error) {
        toast({ 
          title: t('error') || 'Error', 
          description: t('couldNotDeleteMember') || 'Could not delete member', 
          variant: "destructive" 
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
        loadMembers();
      } catch (error) {
        toast({ 
          title: t('error') || 'Error', 
          description: t('couldNotCancelInvitation') || 'Could not cancel invitation', 
          variant: "destructive" 
        });
      }
    }
  };

  const handleSave = async (memberData) => {
    try {
      const user = await User.me();
      if (editingMember && editingMember.id) {
        await FamilyMember.update(editingMember.id, memberData);
        toast({ title: t('memberUpdated') || 'Member updated' });
      } else {
        await FamilyMember.create({ ...memberData, family_id: user.family_id });
        toast({ title: t('memberAdded') || 'Member added' });
      }
      loadMembers();
      setIsDialogOpen(false);
    } catch (error) {
      toast({ 
        title: t('error') || 'Error', 
        description: t('couldNotSaveMember') || 'Could not save member', 
        variant: "destructive" 
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
      });

      loadMembers();
      setIsDialogOpen(false);
    } catch (error) {
      toast({ 
        title: t('error') || 'Error', 
        description: t('couldNotSendInvitation') || 'Could not send invitation', 
        variant: "destructive" 
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
          variant: "default"
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
        pending_user_email: email
      });

      toast({
        title: hasPendingEmail ? (t('invitationUpdated') || 'Invitation Updated') : (t('invitationSent') || 'Invitation Sent'),
        description: `${email} has been invited to connect to ${member.name}'s profile.`,
      });

      loadMembers();
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error connecting email (for non-connected member):", error);
      toast({ 
        title: t('error') || 'Error', 
        description: hasPendingEmail ? (t('couldNotUpdateInvitation') || 'Could not update invitation') : (t('couldNotSendInvitation') || 'Could not send invitation'), 
        variant: "destructive" 
      });
    }
  };

  const handleUpdateConnectedEmail = async (member, newEmail) => {
    let oldConnectedUser;
    try {
        oldConnectedUser = await User.get(member.user_id);
    } catch(e) {
        toast({ title: t('error'), description: t('couldNotFindConnectedUser'), variant: 'destructive' });
        return;
    }
    
    if (oldConnectedUser && oldConnectedUser.email === newEmail) {
        toast({ title: t('noChangeNeeded'), description: t('emailAlreadyConnected'), variant: 'default' });
        return;
    }

    if (!window.confirm(t('confirmDisconnect'))) return;

    try {
      const user = await User.me();

      // 1. Disconnect old user from family
      await User.update(member.user_id, { family_id: null });

      // 2. Find and properly update whitelist entry for the old user's email
      const oldWhitelistEntries = await UserWhitelist.filter({ email: oldConnectedUser.email });
      if (oldWhitelistEntries.length > 0) {
        for (const entry of oldWhitelistEntries) {
          await UserWhitelist.update(entry.id, { 
            status: 'revoked', 
            notes: `Disconnected from ${member.name} on ${new Date().toLocaleDateString()}. Access Revoked.` 
          });
        }
      }

      // 3. Update the member profile to remove user_id and set new pending email
      await FamilyMember.update(member.id, {
        user_id: null,
        pending_user_email: newEmail
      });

      // 4. Whitelist and invite the new email
      await UserWhitelist.create({ 
        email: newEmail.toLowerCase(), // Normalize email
        added_by: user.email, 
        status: 'active', 
        notes: `Invitation for ${member.name}` 
      });
      await FamilyInvitation.create({ email: newEmail, family_id: user.family_id, invited_by: user.email, status: 'pending' });
      
      toast({
        title: t('invitationSent'),
        description: `Invitation sent to ${newEmail}. The previous user has been disconnected.`,
      });

      loadMembers();
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error updating connected email:", error);
      toast({
        title: t('error'),
        description: t('couldNotUpdateInvitation'),
        variant: "destructive",
      });
    }
  };

  const handleStartChat = async (otherMember) => {
    if (!currentUserMember) {
      toast({
        title: t('error') || 'Error',
        description: 'Cannot start chat - user profile not found',
        variant: "destructive"
      });
      return;
    }
    
    try {
      const user = await User.me();
      const existingConvos = await Conversation.filter({ family_id: user.family_id });
      
      // Ensure existingConvos is an array
      const safeConvos = Array.isArray(existingConvos) ? existingConvos : [];
      
      const directChat = safeConvos.find(c => {
        const participants = Array.isArray(c.participants) ? c.participants : [];
        return participants.length === 2 && 
               participants.includes(currentUserMember.id) && 
               participants.includes(otherMember.id);
      });

      if (directChat) {
        navigate(createPageUrl('Chat') + `?id=${directChat.id}`);
      } else {
        const convoName = `${currentUserMember.name} & ${otherMember.name}`;
        const newConvo = await Conversation.create({
          name: convoName,
          family_id: user.family_id,
          participants: [currentUserMember.id, otherMember.id]
        });
        navigate(createPageUrl('Chat') + `?id=${newConvo.id}`);
      }
    } catch (error) {
      console.error("Error starting member chat:", error);
      toast({
        title: t('error') || 'Error',
        description: 'Could not start chat',
        variant: "destructive"
      });
    }
  };

  const handleTourComplete = () => {
    setRunTour(false);
    localStorage.setItem('famly_tour_members_completed', 'true');
  };

  const handleResendInvitation = async (member) => {
    if (!member.pending_user_email || !family) {
      toast({ title: t('error') || 'Error', description: t('missingDataToSendInvitation') || 'Missing data to send invitation.', variant: "destructive" });
      return;
    }

    // Show loading state
    toast({
      title: 'Sending Email...',
      description: `Preparing invitation for ${member.pending_user_email}`,
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
        variant: "destructive" 
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
        
        <div className="space-y-8">
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-blue-500" />
              {t('familyMembers') || 'Family Members'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {regularMembers.map((member, index) => (
                    <motion.div
                      key={member.id}
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
                      
                      {/* Show connection status */}
                      <div className="mb-3 min-h-[36px] flex flex-col justify-center items-center">
                        {member.user_id ? (
                          <div className="flex items-center justify-center gap-1.5 py-1 px-2 bg-green-50 rounded-full border border-green-200">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                            <span className="text-xs text-green-700 font-medium">{t('connected') || 'Connected'}</span>
                          </div>
                        ) : member.pending_user_email ? (
                          <div className="flex items-center justify-center gap-1.5 py-1 px-2 bg-orange-50 rounded-full border border-orange-200">
                            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></div>
                            <span className="text-xs text-orange-700 font-medium">{t('invitationPending') || 'Invitation Pending'}</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5 py-1 px-2 bg-gray-100 rounded-full border border-gray-200">
                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                            <span className="text-xs text-gray-600 font-medium">{t('localOnly') || 'Local Only'}</span>
                          </div>
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
                  key={member.id}
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
        />
    </div>
  );
}
