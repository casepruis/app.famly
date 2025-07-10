
import React, { useState, useEffect } from "react";
import { FamilyMember } from "@/api/entities";
import { Family } from "@/api/entities";
import { FamilyInvitation } from "@/api/entities";
import { User } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Trash2, Mail, Users, Settings, Crown, CreditCard, CheckCircle } from "lucide-react";
import { useLanguage } from "@/components/common/LanguageProvider";

const SUBSCRIPTION_PLANS = [
  {
    id: 'cozy_nest',
    name: 'Cozy Nest',
    price: '€4.99',
    period: '/maand',
    features: ['Tot 4 gezinsleden', 'Basis kalender sync', 'Takenbeheer', 'Email ondersteuning'],
    color: 'bg-blue-50 border-blue-200 text-blue-800'
  },
  {
    id: 'harmony_hub',
    name: 'Harmony Hub',
    price: '€9.99',
    period: '/maand',
    features: ['Tot 8 gezinsleden', 'Geavanceerde AI inzichten', 'App connectoren', 'Prioriteit ondersteuning'],
    color: 'bg-purple-50 border-purple-200 text-purple-800',
    popular: true
  },
  {
    id: 'legacy_circle',
    name: 'Legacy Circle',
    price: '€19.99',
    period: '/maand',
    features: ['Onbeperkt gezinsleden', 'Premium AI functies', 'Alle connectoren', 'Toegewijde ondersteuning'],
    color: 'bg-gold-50 border-gold-200 text-gold-800'
  }
];

export default function Admin() {
  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const { toast } = useToast();
  const { t } = useLanguage();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const user = await User.me();
      if (!user.family_id) return;

      const [familyData, membersData, invitationsData] = await Promise.all([
        Family.get(user.family_id),
        FamilyMember.filter({ family_id: user.family_id }),
        FamilyInvitation.filter({ family_id: user.family_id, status: 'pending' }).catch(() => [])
      ]);

      setFamily(familyData);
      setMembers(membersData);
      setInvitations(invitationsData);
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteMember = async (e) => {
    e.preventDefault();
    if (!inviteEmail || !family) return;

    setIsInviting(true);
    try {
      const user = await User.me();
      await FamilyInvitation.create({
        email: inviteEmail,
        family_id: family.id,
        invited_by: user.email,
        status: 'pending'
      });

      toast({
        title: t('invitationSent') || 'Uitnodiging verzonden',
        description: `${inviteEmail} is uitgenodigd om lid te worden van je Famly.`,
      });

      setInviteEmail('');
      loadData();
    } catch (error) {
      toast({
        title: t('invitationFailed') || 'Uitnodiging mislukt',
        description: t('couldNotSendInvitation') || 'Kon uitnodiging niet verzenden. Probeer opnieuw.',
        variant: 'destructive'
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleDeleteInvitation = async (invitationId) => {
    if (!window.confirm(t('confirmDeleteInvitation') || 'Weet je zeker dat je deze uitnodiging wilt verwijderen?')) return;

    try {
      await FamilyInvitation.delete(invitationId);
      toast({
        title: t('invitationDeleted') || 'Uitnodiging verwijderd',
        description: t('invitationRemoved') || 'De uitnodiging is verwijderd.',
      });
      loadData();
    } catch (error) {
      toast({
        title: t('deleteFailed') || 'Verwijderen mislukt',
        description: t('couldNotDeleteInvitation') || 'Kon uitnodiging niet verwijderen.',
        variant: 'destructive'
      });
    }
  };

  const handleUpdateFamilySettings = async (settings) => {
    try {
      await Family.update(family.id, settings);
      toast({
        title: t('settingsUpdated') || 'Settings Updated',
        description: t('famlySettingsSaved') || 'Famly settings have been saved.',
      });
      loadData();
    } catch (error) {
      toast({
        title: t('updateFailed') || 'Update Failed',
        description: t('couldNotUpdateSettings') || 'Could not update settings.',
        variant: 'destructive'
      });
    }
  };

  const handlePromoteToAdmin = async (memberId) => {
    try {
      // Find the member's user_id first
      const member = members.find(m => m.id === memberId);
      if (!member || !member.user_id) {
        toast({
          title: t('error') || 'Error',
          description: t('cannotPromoteNoUser') || 'Cannot promote member - no connected user account.',
          variant: 'destructive'
        });
        return;
      }

      // Update the user's role to admin
      await User.update(member.user_id, { role: 'admin' });

      toast({
        title: t('memberPromoted') || 'Member Promoted',
        description: `${member.name} ${t('isNowAdmin') || 'is now a famly administrator'}.`,
      });

      loadData();
    } catch (error) {
      toast({
        title: t('promotionFailed') || 'Promotion Failed',
        description: t('couldNotPromoteMember') || 'Could not promote member to admin.',
        variant: 'destructive'
      });
    }
  };

  const handleUpgradePlan = async (planId) => {
    try {
      // Call Adyen checkout function
      const { data } = await fetch('/functions/adyenCheckout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, familyId: family.id })
      });

      // Redirect to Adyen checkout
      window.location.href = data.checkoutUrl;
    } catch (error) {
      toast({
        title: t('paymentFailed') || 'Betaling mislukt',
        description: t('couldNotInitiatePayment') || 'Kon betaling niet initiëren.',
        variant: 'destructive'
      });
    }
  };

  if (isLoading) {
    return <div className="p-6 text-center">{t('loading') || 'Laden'}...</div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('famlyAdmin') || 'Famly Administration'}</h1>
        <p className="text-gray-600">{t('manageFamlySettings') || 'Manage your famly settings and members.'}</p>
      </div>

      <Tabs defaultValue="members" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="members">{t('members') || 'Leden'}</TabsTrigger>
          <TabsTrigger value="invitations">{t('invitations') || 'Uitnodigingen'}</TabsTrigger>
          <TabsTrigger value="subscription">{t('subscription') || 'Abonnement'}</TabsTrigger>
          <TabsTrigger value="settings">{t('settings') || 'Instellingen'}</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                {t('famlyMembers') || 'Famly Members'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
                        style={{ backgroundColor: member.color }}
                      >
                        {member.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{member.name}</p>
                        <p className="text-sm text-gray-500 capitalize">{t(member.role) || member.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {member.user_id && (
                        <Badge variant="outline" className="text-green-600 border-green-300">
                          <Crown className="w-3 h-3 mr-1" />
                          {t('connected') || 'Verbonden'}
                        </Badge>
                      )}
                      {member.user_id && member.role !== 'ai_assistant' && member.role !== 'admin' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePromoteToAdmin(member.id)}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          {t('makeAdmin') || 'Make Admin'}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                {t('inviteNewMember') || 'Nieuw lid uitnodigen'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInviteMember} className="space-y-4">
                <Input
                  type="email"
                  placeholder={t('enterEmailAddress') || 'Voer email adres in'}
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
                <Button type="submit" disabled={isInviting} className="w-full">
                  {isInviting ? (t('sending') || 'Versturen...') : (t('sendInvitation') || 'Uitnodiging versturen')}
                </Button>
              </form>
            </CardContent>
          </Card>

          {invitations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('pendingInvitations') || 'Openstaande uitnodigingen'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {invitations.map((invitation) => (
                    <div key={invitation.id} className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{invitation.email}</p>
                        <p className="text-sm text-gray-500">
                          {t('invitedBy') || 'Uitgenodigd door'} {invitation.invited_by}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">{t(invitation.status) || invitation.status}</Badge>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteInvitation(invitation.id)}
                          className="h-8 w-8 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="subscription" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                {t('currentPlan') || 'Huidig abonnement'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {family && (
                <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div>
                    <h3 className="font-semibold text-blue-900 capitalize">
                      {SUBSCRIPTION_PLANS.find(p => p.id === family.subscription_plan)?.name || family.subscription_plan || 'Gratis'}
                    </h3>
                    <p className="text-sm text-blue-700">
                      {t('status') || 'Status'}: <span className="capitalize">{t(family.subscription_status) || family.subscription_status || 'actief'}</span>
                    </p>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    {t('active') || 'Actief'}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SUBSCRIPTION_PLANS.map((plan) => (
              <Card key={plan.id} className={`relative ${plan.popular ? 'ring-2 ring-purple-500' : ''}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-purple-500 text-white px-3 py-1">
                      {t('popular') || 'Populair'}
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <div className="text-3xl font-bold text-gray-900">
                    {plan.price}
                    <span className="text-sm font-normal text-gray-500">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={family?.subscription_plan === plan.id ? 'outline' : 'default'}
                    disabled={family?.subscription_plan === plan.id}
                    onClick={() => handleUpgradePlan(plan.id)}
                  >
                    {family?.subscription_plan === plan.id
                      ? (t('currentPlanBtn') || 'Huidig abonnement')
                      : (t('selectPlan') || 'Kies abonnement')
                    }
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                {t('famlySettings') || 'Famly Settings'}
              </CardTitle>
              {family && (
                <p className="text-xs text-gray-500 font-mono">Famly ID: {family.id}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('famlyName') || 'Famly Name'}
                </label>
                <Input
                  value={family?.name || ''}
                  onChange={(e) => setFamily({ ...family, name: e.target.value })}
                  onBlur={() => handleUpdateFamilySettings({ name: family.name })}
                  placeholder={t('enterFamlyName') || 'Enter famly name'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('defaultLanguage') || 'Standaard taal'}
                </label>
                <Select
                  value={family?.language || 'nl'}
                  onValueChange={(value) => handleUpdateFamilySettings({ language: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nl">Nederlands</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
