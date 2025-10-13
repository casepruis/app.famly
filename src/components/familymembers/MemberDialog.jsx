

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit, Plus, CalendarIcon, Palette, Lock, Bot, Mail, UserPlus, Link as LinkIcon } from "lucide-react";
import { format } from 'date-fns';
import { useLanguage } from "@/components/common/LanguageProvider";
import { getLanguageInfo } from "@/components/common/translations";

// Predefined colors to choose from
const availableColors = [
  '#ef4444', '#f97316', '#84cc16', '#22c55e', '#14b8a6', 
  '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#ec4899',
];

export default function MemberDialog({ isOpen, onClose, member, onSave, onInvite, onConnectEmail, autoFillNameFromEmail }) {
  const { t, familyLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState('member');
  const [memberData, setMemberData] = useState({
    name: '',
    email: '', // will be set from user_id
    role: 'child',
    dob: '',
    color: availableColors[0],
    language: familyLanguage,
    wishlist_password: ''
  });
  
  const [inviteData, setInviteData] = useState({
    email: '',
    name: '',
    role: 'child'
  });
  // Track previous name for auto-fill logic
  const [prevInviteName, setPrevInviteName] = useState('');

  const [connectEmailData, setConnectEmailData] = useState({
    email: ''
  });

  const isEditing = !!member;
  const isAI = member?.role === 'ai_assistant';
  const hasUserAccount = !!member?.user_id && !!member?.email;
  const hasPendingEmail = !!member?.pending_user_email;

  // Supported languages
  const languages = ['en', 'es', 'fr', 'de', 'nl', 'it', 'pt'];

  // Always call useState for editEmail
  const [editEmail, setEditEmail] = useState(member?.email || '');
  // Sync editEmail when dialog opens or member changes
  useEffect(() => {
    // Use user_id as the email for connected members
    setEditEmail(member?.user_id || '');
    setMemberData(prev => ({
      ...prev,
      email: member?.user_id || '',
      name: member?.name || '',
    }));
  }, [isOpen, member]);
  // Handle member form submit
  const handleMemberSubmit = async (e) => {
    e.preventDefault();
    // If editing and email changed, call onConnectEmail (which should trigger a PUT to backend)
    if (isEditing && member && editEmail && editEmail !== (member.user_id || member.email)) {
      if (onConnectEmail) {
        await onConnectEmail(member, editEmail);
      }
      // Do not call onSave here, as onConnectEmail should handle the update
      return;
    }
    let payload;
    if (!isEditing) {
      // For new member, use inviteData for name, role, email, and merge with other fields from memberData
      payload = {
        ...memberData,
        name: inviteData.name,
        role: inviteData.role,
        pending_user_email: inviteData.email,
        user_id: inviteData.email,
      };
      // Remove email field if present
      delete payload.email;
    } else {
      // For editing, use memberData and set user_id if connecting by email
      payload = { ...memberData };
      if (editEmail) {
        payload.user_id = editEmail;
      }
      delete payload.email;
    }
    if (onSave) onSave(payload);
  };

  if (!isOpen) return null;

  const handleEmailChange = async (e) => {
    e.preventDefault();
    if (onConnectEmail && editEmail && editEmail !== member.email) {
      await onConnectEmail(member, editEmail);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isAI ? <Bot className="w-5 h-5" /> : (isEditing ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />)}
            {isAI ? t('editAIAssistant') : (isEditing ? t('editMember') : t('addMember'))}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleMemberSubmit} className="space-y-4 pt-2">
          {/* Only show the main name field for editing or AI assistant, not for new member invite */}
          {(isAI || isEditing) && (
            <div>
              <Label htmlFor="name">{isAI ? t('aiName') : t('memberName')}</Label>
              <Input
                id="name"
                value={memberData.name}
                onChange={(e) => setMemberData(prev => ({ ...prev, name: e.target.value }))}
                placeholder={isAI ? t('aiNamePlaceholder') : undefined}
                required
              />
            </div>
          )}
          {/* Always show email field for editing (readonly for non-admins if needed) */}
          {!isAI && isEditing && (
            <div>
              <Label htmlFor="email">{t('emailAddress') || 'Email Address'}</Label>
              <Input
                id="email"
                type="email"
                value={editEmail}
                onChange={e => {
                  setEditEmail(e.target.value);
                  setMemberData(prev => ({ ...prev, email: e.target.value }));
                }}
                className="flex-1"
                required
              />
              {/* Show the current user_id as info if different from editEmail */}
              {member?.user_id && member.user_id !== editEmail && (
                <div className="text-xs text-gray-500 mt-1">Current: {member.user_id}</div>
              )}
            </div>
          )}

          {/* Pending invitation email for non-AI members */}
          {!isAI && isEditing && hasPendingEmail && !hasUserAccount && (
            <div>
              <Label>{t('pendingInvitationEmail') || 'Pending Invitation Email'}</Label>
              <div className="flex gap-2 items-center">
                <Input value={member.pending_user_email} disabled className="flex-1" />
                {/* Optionally allow resending invitation here */}
              </div>
              <p className="text-xs text-gray-500 mt-1">{t('pendingEmailHelper') || 'This member has a pending invitation.'}</p>
            </div>
          )}

          {/* Email for new member (invite by email) */}
          {!isAI && !isEditing && (
            <>
              <div>
                <Label htmlFor="invite-email">{t('emailAddress')}</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteData.email}
                  onChange={(e) => setInviteData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder={t('enterEmailAddress')}
                  required
                />
              </div>
              <div>
                <Label htmlFor="invite-name">{t('memberName')}</Label>
                <Input
                  id="invite-name"
                  value={inviteData.name}
                  onChange={(e) => {
                    setInviteData(prev => ({ ...prev, name: e.target.value }));
                    setPrevInviteName(e.target.value);
                  }}
                  placeholder={t('memberName')}
                  required
                />
              </div>
              <div>
                <Label htmlFor="invite-role">{t('role')}</Label>
                <Select value={inviteData.role} onValueChange={(value) => setInviteData(prev => ({ ...prev, role: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="parent">{t('parent')}</SelectItem>
                    <SelectItem value="teen">{t('teen')}</SelectItem>
                    <SelectItem value="child">{t('child')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Other member fields (DOB, color, language, wishlist password) */}
          {/* Show for all non-AI members (new or editing), but only show role field in the correct place */}
          {!isAI && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dob">{t('dateOfBirth')}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {memberData.dob ? format(new Date(memberData.dob), 'PPP') : t('selectDate')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={memberData.dob ? new Date(memberData.dob) : undefined}
                        onSelect={(date) => setMemberData(prev => ({ 
                          ...prev, 
                          dob: date ? format(date, 'yyyy-MM-dd') : '' 
                        }))}
                        disabled={(date) => date > new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                {/* Only show the role field here for editing, not for new member invite */}
                {isEditing && (
                  <div>
                    <Label htmlFor="role">{t('role')}</Label>
                    <Select value={memberData.role} onValueChange={(value) => setMemberData(prev => ({ ...prev, role: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="parent">{t('parent')}</SelectItem>
                        <SelectItem value="teen">{t('teen')}</SelectItem>
                        <SelectItem value="child">{t('child')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Palette className="w-4 h-4"/>
                  {t('profileColor')}
                </Label>
                <div className="flex flex-wrap gap-2">
                  {availableColors.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setMemberData(prev => ({ ...prev, color: c }))}
                      className={`w-8 h-8 rounded-full transition-all ${memberData.color === c ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="language">{t('language')}</Label>
                <Select value={memberData.language} onValueChange={(value) => setMemberData(prev => ({ ...prev, language: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map(lang => {
                      const info = getLanguageInfo(lang);
                      return (
                        <SelectItem key={lang} value={lang}>
                          <span className="flex items-center gap-2">
                            <span>{info.flag}</span>
                            <span>{info.name}</span>
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="wishlist-password" className="flex items-center gap-2">
                  <Lock className="w-4 h-4"/>
                  {t('wishlistPassword')}
                </Label>
                <Input
                  id="wishlist-password"
                  type="text"
                  value={memberData.wishlist_password}
                  onChange={e => setMemberData(prev => ({ ...prev, wishlist_password: e.target.value }))}
                  placeholder={t('optionalPassword')}
                />
                <p className="text-xs text-gray-500 mt-1">{t('wishlistPasswordHelper')}</p>
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('cancel')}</Button>
            <Button type="submit">{t('save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
// End of component
}
