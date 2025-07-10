import React, { useState, useEffect } from 'react';
import { User, Family, FamilyInvitation, FamilyMember } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Debug() {
  const [debugData, setDebugData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadDebugData();
  }, []);

  const loadDebugData = async () => {
    try {
      const user = await User.me();
      const allFamilies = await Family.list();
      const allInvitations = await FamilyInvitation.list();
      const allMembers = await FamilyMember.list();
      
      setDebugData({
        currentUser: user,
        allFamilies,
        allInvitations,
        allMembers,
        userInvitations: allInvitations.filter(inv => inv.email === user.email),
        userPendingInvitations: allInvitations.filter(inv => inv.email === user.email && inv.status === 'pending')
      });
    } catch (error) {
      console.error('Debug load error:', error);
      setDebugData({ error: error.message });
    }
    setIsLoading(false);
  };

  const handleForceJoinFamily = async () => {
    try {
      const user = await User.me();
      const pruisiesFamily = debugData.allFamilies.find(f => f.name.toLowerCase().includes('pruis'));
      
      if (pruisiesFamily) {
        await User.updateMyUserData({ family_id: pruisiesFamily.id, role: 'member' });
        
        // Create member profile if doesn't exist
        const existingMember = debugData.allMembers.find(m => m.user_id === user.id && m.family_id === pruisiesFamily.id);
        if (!existingMember) {
          await FamilyMember.create({
            name: user.full_name || 'Kees',
            role: 'parent',
            family_id: pruisiesFamily.id,
            user_id: user.id,
            color: '#10b981',
            language: 'nl'
          });
        }
        
        navigate(createPageUrl('Dashboard'));
      }
    } catch (error) {
      console.error('Force join error:', error);
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading debug info...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Debug Information</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Current User</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-sm bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify(debugData.currentUser, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Families</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-sm bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify(debugData.allFamilies, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>User Invitations</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-sm bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify(debugData.userInvitations, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>User Pending Invitations</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-sm bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify(debugData.userPendingInvitations, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Members</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-sm bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify(debugData.allMembers, null, 2)}
          </pre>
        </CardContent>
      </Card>

      {debugData.allFamilies?.find(f => f.name.toLowerCase().includes('pruis')) && (
        <Button onClick={handleForceJoinFamily} className="w-full">
          Force Join Pruisies Family
        </Button>
      )}
    </div>
  );
}