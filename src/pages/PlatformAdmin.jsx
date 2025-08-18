
import React, { useState, useEffect } from "react";
import { UserWhitelist } from "@/api/entities";
import { Family } from "@/api/entities";
import { User } from "@/api/entities";
import { FamilyMember } from "@/api/entities";
import { Task } from "@/api/entities";
import { ScheduleEvent } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  Trash2, Mail, Users, Settings, Crown, CreditCard, CheckCircle,
  Shield, UserPlus, FileUp, DatabaseZap, Loader2, Database, AlertCircle,
  Activity, DollarSign
} from "lucide-react";
import { useLanguage } from "@/components/common/LanguageProvider";
import { createPageUrl } from "@/utils";
import { Link, useNavigate } from "react-router-dom";
import { deleteFamily } from "@/api/functions";

// Define platform administrators' emails for access control
// In a real application, this would typically come from a secure configuration,
// environment variables, or a database, not hardcoded.
const PLATFORM_ADMINS = [
    // Add admin emails here, e.g., "admin@example.com", "another.admin@example.com"
    "kees.pruis@gmail.com"
];

export default function PlatformAdmin() {
  const [whitelistedUsers, setWhitelistedUsers] = useState([]);
  const [families, setFamilies] = useState([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserNotes, setNewUserNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalFamilies: 0,
    totalMembers: 0,
    totalTasks: 0,
    totalEvents: 0,
    monthlyRevenue: 0
  });

  const navigate = useNavigate(); // Initialize useNavigate hook for redirection

  const { t } = useLanguage();
  const { toast } = useToast();

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const user = await User.me();
        // Check if the current user's email is in the list of PLATFORM_ADMINS
        if (!user || !PLATFORM_ADMINS.includes(user.user_id)) {
          // If not an admin, redirect to the Dashboard
          toast({
            title: t('accessDenied') || 'Access Denied',
            description: t('youDoNotHavePermissionToAccessThisPage') || 'You do not have permission to access this page.',
            variant: 'destructive',
          });
          navigate(createPageUrl("Dashboard"));
        } else {
          // If admin, load the platform data
          loadData();
        }
      } catch (error) {
        // If there's an error fetching user (e.g., not logged in), redirect to Index
        toast({
          title: t('authenticationRequired') || 'Authentication Required',
          description: t('pleaseLogInToAccessThisPage') || 'Please log in to access this page.',
          variant: 'destructive',
        });
        navigate(createPageUrl("Index"));
      }
    };
    checkAccess();
  }, [navigate, t, toast]); // Add toast to dependency array

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [users, familiesData, allMembers, allTasks, allEvents] = await Promise.all([
        UserWhitelist.list().catch(() => []),
        Family.list().catch(() => []),
        FamilyMember.list().catch(() => []),
        Task.list().catch(() => []),
        ScheduleEvent.list().catch(() => [])
      ]);

      const uniqueUsers = Array.from(new Map(users.filter(u => u && u.email).map(u => [u.email, u])).values());
      setWhitelistedUsers(uniqueUsers);

      // More robust de-duplication using a Map, keyed by ID
      const uniqueFamilies = Array.from(new Map(familiesData.filter(f => f && f.id).map(f => [f.id, f])).values());
      setFamilies(uniqueFamilies);

      const monthlyRevenue = uniqueFamilies.reduce((total, family) => {
        const planPrices = { cozy_nest: 4.99, harmony_hub: 9.99, legacy_circle: 19.99 };
        return total + (planPrices[family.subscription_plan] || 0);
      }, 0);

      setStats({
        totalUsers: uniqueUsers.length,
        totalFamilies: uniqueFamilies.length,
        totalMembers: allMembers.length,
        totalTasks: allTasks.length,
        totalEvents: allEvents.length,
        monthlyRevenue: monthlyRevenue
      });
    } catch (error) {
      console.error('Error loading platform data:', error);
      toast({ title: t('error'), description: t('couldNotLoadPlatformData'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUserEmail) return;

    setIsAdding(true);
    try {
      const currentUser = await User.me();
      await UserWhitelist.create({
        email: newUserEmail.toLowerCase(), // Normalize email
        added_by: currentuser.user_id,
        notes: newUserNotes || null,
        status: 'active'
      });

      toast({
        title: t('userAdded'),
        description: `User ${newUserEmail} added to platform`,
      });

      setNewUserEmail('');
      setNewUserNotes('');
      loadData();
    } catch (error) {
      toast({
        title: t('addFailed'),
        description: t('couldNotAddUser'),
        variant: 'destructive'
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleRevokeUser = async (userId) => {
    if (!window.confirm('Are you sure you want to revoke access for this user?')) return;

    try {
      await UserWhitelist.update(userId, { status: 'revoked' });
      toast({
        title: 'Access Revoked',
        description: 'User access has been revoked',
      });
      loadData();
    } catch (error) {
      toast({
        title: 'Revoke Failed',
        description: 'Could not revoke access',
        variant: 'destructive'
      });
    }
  };

  const handleReactivateUser = async (userId) => {
    if (!window.confirm('Are you sure you want to reactivate access for this user?')) return;

    try {
      // Fetch the existing record to get the email
      const userToReactivate = await UserWhitelist.get(userId);
      if (!userToReactivate) {
        throw new Error("User not found in whitelist.");
      }

      // Update the record, ensuring the email is lowercase
      await UserWhitelist.update(userId, {
        email: userToReactivate.email.toLowerCase(), // This is the critical fix
        status: 'active',
        notes: `Reactivated on ${new Date().toLocaleDateString()}`
      });

      toast({
        title: 'Access Reactivated',
        description: 'User access has been reactivated',
      });
      loadData();
    } catch (error) {
      console.error("Reactivation Error:", error);
      toast({
        title: 'Reactivation Failed',
        description: 'Could not reactivate access',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to permanently delete this user from the whitelist? This cannot be undone.')) return;

    setDeletingId(userId);
    try {
      await UserWhitelist.delete(userId);
      toast({
        title: 'User Deleted',
        description: 'User has been removed from the whitelist.',
      });
      loadData();
    } catch (error) {
      toast({
        title: 'Delete Failed',
        description: 'Could not delete user.',
        variant: 'destructive'
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteFamily = async (family) => {
    if (!window.confirm(`Are you sure you want to permanently delete the family "${family.name}"? This will delete all members, events, and tasks associated with it. This action CANNOT be undone.`)) return;

    setDeletingId(family.id);
    try {
      await deleteFamily({ family_id: family.id });
      toast({
        title: "Family Deleted",
        description: `The family "${family.name}" has been permanently deleted.`
      });
      loadData();
    } catch (error) {
       toast({
        title: "Delete Failed",
        description: `Could not delete family. Error: ${error.message}`,
        variant: 'destructive'
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleGrantFamilyAdmin = async (familyId) => {
    if (!window.confirm('Are you sure you want to grant admin rights to this family creator?')) return;

    try {
      // Find the family
      const family = families.find(f => f.id === familyId);
      if (!family) {
        toast({
          title: 'Error',
          description: 'Family not found',
          variant: 'destructive'
        });
        return;
      }

      // Find all users to locate the family creator
      // Note: In a production environment, you might want a more efficient way to fetch
      // a specific user by email or ID if User.list() is very large.
      const allUsers = await User.list();
      const familyCreator = allUsers.find(u => u.email === family.created_by);

      if (!familyCreator) {
        toast({
          title: 'Error',
          description: 'Family creator not found in users',
          variant: 'destructive'
        });
        return;
      }

      // Update the creator's role to admin
      await User.update(familyCreator.id, { role: 'admin' });

      toast({
        title: 'Admin Rights Granted',
        description: `${family.created_by} has been granted admin rights for ${family.name}`,
      });

      loadData();
    } catch (error) {
      toast({
        title: 'Failed to Grant Admin Rights',
        description: 'Could not grant admin rights',
        variant: 'destructive'
      });
    }
  };

  if (isLoading) {
    return <div className="p-6 text-center">Loading platform data...</div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Platform Admin</h1>
        <p className="text-gray-600">Global system management and oversight.</p>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="families">Families</TabsTrigger>
          <TabsTrigger value="data">Data Tools</TabsTrigger>
          <TabsTrigger value="settings">System Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          {/* Platform Statistics Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalUsers}</div>
                <p className="text-xs text-muted-foreground">Platform access granted</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Families</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalFamilies}</div>
                <p className="text-xs text-muted-foreground">Registered families</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Members</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalMembers}</div>
                <p className="text-xs text-muted-foreground">Family members in system</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalTasks}</div>
                <p className="text-xs text-muted-foreground">Tasks created in system</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Events</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalEvents}</div>
                <p className="text-xs text-muted-foreground">Events scheduled in system</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">€{stats.monthlyRevenue.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Recurring revenue</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                Add New User
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddUser} className="space-y-4">
                <Input
                  type="email"
                  placeholder="Enter email address"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  required
                />
                <Textarea
                  placeholder="Optional notes"
                  value={newUserNotes}
                  onChange={(e) => setNewUserNotes(e.target.value)}
                  rows={3}
                />
                <Button type="submit" disabled={isAdding} className="w-full">
                  {isAdding ? 'Adding...' : 'Add User to Platform'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Allowed Users ({whitelistedUsers.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {whitelistedUsers.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No users allowed yet</p>
                ) : (
                  whitelistedUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{user.user_id}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-sm text-gray-500">Added by {user.added_by}</p>
                          <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                            {user.status}
                          </Badge>
                        </div>
                        {user.notes && (
                          <p className="text-sm text-gray-600 mt-1 truncate">{user.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                          {deletingId === user.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              {user.status === 'active' && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleRevokeUser(user.id)}
                                  className="h-8 w-8 text-yellow-600 hover:text-yellow-700 flex-shrink-0"
                                  title="Revoke Access"
                                >
                                  <Shield className="w-4 h-4" />
                                </Button>
                              )}
                              {user.status === 'revoked' && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleReactivateUser(user.id)}
                                  className="h-8 w-8 text-green-600 hover:text-green-700 flex-shrink-0"
                                  title="Reactivate Access"
                                >
                                  <UserPlus className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteUser(user.id)}
                                className="h-8 w-8 text-red-500 hover:text-red-700 flex-shrink-0"
                                title="Delete User"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="families" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Family Subscriptions ({families.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {families.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No families registered yet</p>
                ) : (
                  families.map((family) => (
                    <div key={family.id} className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{family.name}</p>
                        <p className="font-mono text-xs text-gray-500">ID: {family.id}</p>
                        <p className="text-sm text-gray-500 truncate">Created by: {family.created_by}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className="capitalize">
                            {family.subscription_plan?.replace('_', ' ') || 'Unknown Plan'}
                          </Badge>
                          <Badge variant={family.subscription_status === 'active' ? 'default' : 'secondary'}>
                            {family.subscription_status || 'active'}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="font-medium text-gray-900">
                            €{
                              family.subscription_plan === 'cozy_nest' ? '4.99' :
                              family.subscription_plan === 'harmony_hub' ? '9.99' :
                              family.subscription_plan === 'legacy_circle' ? '19.99' : '0.00'
                            }/month
                          </p>
                          <p className="text-sm text-gray-500">
                            {family.subscription_expires ?
                              `Expires ${new Date(family.subscription_expires).toLocaleDateString()}` :
                              'No expiration date'
                            }
                          </p>
                        </div>
                        {deletingId === family.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleGrantFamilyAdmin(family.id)}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              Grant Admin
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteFamily(family)}
                              className="h-8 w-8 text-red-500 hover:text-red-700"
                              title={`Delete ${family.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DatabaseZap className="w-5 h-5" />
                Data Integrity Tools
              </CardTitle>
            </CardHeader>
            <CardContent>
                <Link to={createPageUrl('DataCleanup')}>
                  <Button variant="outline">Normalize Whitelist Data</Button>
                </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
            {/* System Settings Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Settings className="w-5 h-5" />
                        System Settings
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-gray-600">
                        No system-wide settings available yet.
                    </p>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
