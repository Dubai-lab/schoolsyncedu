import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFetch, useMutate } from '@/hooks/useFetch';
import { userPreferencesService } from '@/services/settingsService';
import { authService } from '@/services/authService';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { notify } from '@/components/shared/Toast';
import { Save, User, Shield, Lock, Eye, EyeOff } from 'lucide-react';

export default function UserPreferences() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const { data: profile, isLoading } = useFetch(
    ['user-profile', userId],
    () => userPreferencesService.getProfile(userId),
    { enabled: !!userId }
  );

  const [form, setForm] = useState<Record<string, string>>({});

  // Change password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const merged = { ...profile, ...form };

  const updateMutation = useMutate(
    (payload: Record<string, string>) => userPreferencesService.updateProfile(userId, payload),
    [['user-profile', userId]]
  );

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handlePasswordChange = async () => {
    setPasswordError('');
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }
    setPasswordSaving(true);
    try {
      await authService.updatePassword(newPassword);
      notify.success('Password changed successfully');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSave = () => {
    if (!Object.keys(form).length) return;
    updateMutation.mutate(form, {
      onSuccess: () => {
        notify.success('Profile updated');
        setForm({});
      },
      onError: () => notify.error('Failed to update profile'),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Settings', href: '/settings' }, { label: 'User Preferences' }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Preferences</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Update your personal information and account settings.
          </p>
        </div>
        <Button onClick={handleSave} loading={updateMutation.isPending} disabled={!Object.keys(form).length}>
          <Save className="w-4 h-4 mr-2" />
          Save Changes
        </Button>
      </div>

      {/* Account Info (read-only) */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Account</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <p className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
              {profile?.email ?? '—'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
            <div className="mt-1">
              <Badge variant="info">{(profile?.role as string ?? '').replace(/_/g, ' ')}</Badge>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
            <Badge variant={profile?.is_active ? 'success' : 'danger'}>
              {profile?.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Login</label>
            <p className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
              {profile?.last_login ? new Date(profile.last_login as string).toLocaleString() : 'Never'}
            </p>
          </div>
        </div>
      </Card>

      {/* Editable Profile */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Personal Information</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="First Name"
            value={(merged?.first_name as string) ?? ''}
            onChange={(e) => set('first_name', e.target.value)}
          />
          <Input
            label="Last Name"
            value={(merged?.last_name as string) ?? ''}
            onChange={(e) => set('last_name', e.target.value)}
          />
          <Input
            label="Phone"
            value={(merged?.phone as string) ?? ''}
            onChange={(e) => set('phone', e.target.value)}
          />
          <Input
            label="Profile Photo URL"
            value={(merged?.profile_photo_url as string) ?? ''}
            onChange={(e) => set('profile_photo_url', e.target.value)}
          />
        </div>
      </Card>

      {/* Change Password */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Change Password</h2>
          </div>
          <button
            type="button"
            onClick={() => setShowPasswords((s) => !s)}
            className="text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1"
          >
            {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showPasswords ? 'Hide' : 'Show'}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              New Password
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 6 characters"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirm New Password
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={handlePasswordChange}
              loading={passwordSaving}
              disabled={!newPassword || !confirmPassword}
              className="w-full"
            >
              <Lock className="w-4 h-4 mr-2" />
              Update Password
            </Button>
          </div>
        </div>
        {passwordError && (
          <p className="mt-3 text-sm text-red-600">{passwordError}</p>
        )}
        <p className="mt-3 text-xs text-slate-400">
          You will remain logged in after changing your password.
        </p>
      </Card>
    </div>
  );
}
