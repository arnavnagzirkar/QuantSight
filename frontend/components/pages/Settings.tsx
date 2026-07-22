import { useEffect, useRef, useState } from 'react';
import { Lock, LogOut, Monitor, Moon, Save, Sun, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useTheme } from '../ThemeProvider';
import { TickerMultiSelect } from '../TickerMultiSelect';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPersistentState } from '@/hooks/usePersistentState';
import { settingsAPI } from '@/services/api';
import { supabase } from '@/services/supabase';
import type { UserSettings } from '@/types/api';

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'system',
  timezone: 'UTC',
  default_tickers: ['AAPL', 'MSFT', 'GOOGL'],
  default_model_type: 'xgb',
  default_train_window: 750,
  default_test_window: 63,
  default_max_folds: 10,
  notify_job_complete: true,
};

export function Settings() {
  const { theme, setTheme } = useTheme();
  const { profile, signOut, user } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useUserPersistentState<UserSettings>('settings:draft', DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useUserPersistentState<UserSettings>('settings:saved', DEFAULT_SETTINGS);
  const [draftDirty, setDraftDirty] = useUserPersistentState('settings:draft-dirty', false);
  const [activeTab, setActiveTab] = useUserPersistentState('settings:active-tab', 'general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const draftDirtyRef = useRef(draftDirty);
  draftDirtyRef.current = draftDirty;

  useEffect(() => {
    let active = true;
    settingsAPI.getSettings()
      .then(response => {
        if (!active) return;
        setSavedSettings(response.data);
        if (!draftDirtyRef.current) {
          setSettings(response.data);
          setTheme(response.data.theme);
        }
      })
      .catch(fetchError => {
        if (active) setError(fetchError instanceof Error ? fetchError.message : 'Unable to load settings');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [setSavedSettings, setSettings, setTheme]);

  const updateSetting = <Key extends keyof UserSettings>(key: Key, value: UserSettings[Key]) => {
    setSettings(current => ({ ...current, [key]: value }));
    setDraftDirty(true);
  };

  const handleThemeChange = (nextTheme: UserSettings['theme']) => {
    setTheme(nextTheme);
    updateSetting('theme', nextTheme);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await settingsAPI.updateSettings(settings);
      setSettings(response.data);
      setSavedSettings(response.data);
      setDraftDirty(false);
      setTheme(response.data.theme);
      toast.success('Settings saved');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setSettings(savedSettings);
    setDraftDirty(false);
    setTheme(savedSettings.theme);
    setError(null);
  };

  const handlePasswordUpdate = async () => {
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setUpdatingPassword(true);
    setError(null);
    const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });
    setUpdatingPassword(false);
    if (passwordError) {
      setError(passwordError.message);
      return;
    }
    setNewPassword('');
    setConfirmPassword('');
    toast.success('Password updated');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your research defaults and account</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Card className="p-8 text-center text-muted-foreground">Loading settings...</Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="models">Models</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <Card className="p-6 space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Appearance</h2>
                <p className="text-sm text-muted-foreground">Applied on this device and saved to your account</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <ThemeButton label="Light" active={theme === 'light'} icon={Sun} onClick={() => handleThemeChange('light')} />
                <ThemeButton label="Dark" active={theme === 'dark'} icon={Moon} onClick={() => handleThemeChange('dark')} />
                <ThemeButton label="System" active={theme === 'system'} icon={Monitor} onClick={() => handleThemeChange('system')} />
              </div>
              <div className="space-y-2 max-w-sm">
                <Label htmlFor="timezone">Timezone</Label>
                <Select value={settings.timezone} onValueChange={value => updateSetting('timezone', value)}>
                  <SelectTrigger id="timezone"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/New_York">Eastern Time</SelectItem>
                    <SelectItem value="America/Chicago">Central Time</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                    <SelectItem value="Europe/London">London</SelectItem>
                    <SelectItem value="Asia/Kolkata">India</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>

            <Card className="p-6 space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Research Defaults</h2>
                <p className="text-sm text-muted-foreground">Used to initialize new analyses</p>
              </div>
              <div className="space-y-2">
                <Label>Default tickers</Label>
                <TickerMultiSelect
                  value={settings.default_tickers}
                  onChange={value => updateSetting('default_tickers', value)}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="job-notification">Job completion notice</Label>
                  <p className="text-sm text-muted-foreground">Show an in-app notice when background work finishes</p>
                </div>
                <Switch
                  id="job-notification"
                  checked={settings.notify_job_complete}
                  onCheckedChange={value => updateSetting('notify_job_complete', value)}
                />
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="models">
            <Card className="p-6 space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Model Defaults</h2>
                <p className="text-sm text-muted-foreground">Initial values for Model Lab and experiments</p>
              </div>
              <div className="space-y-2 max-w-sm">
                <Label htmlFor="default-model">Model family</Label>
                <Select
                  value={settings.default_model_type}
                  onValueChange={(value: UserSettings['default_model_type']) => updateSetting('default_model_type', value)}
                >
                  <SelectTrigger id="default-model"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="xgb">XGBoost</SelectItem>
                    <SelectItem value="lstm">LSTM</SelectItem>
                    <SelectItem value="ensemble">XGBoost + LSTM Ensemble</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <NumberSetting
                  id="train-window"
                  label="Training window"
                  value={settings.default_train_window}
                  min={250}
                  max={3000}
                  onChange={value => updateSetting('default_train_window', value)}
                />
                <NumberSetting
                  id="test-window"
                  label="Test window"
                  value={settings.default_test_window}
                  min={5}
                  max={252}
                  onChange={value => updateSetting('default_test_window', value)}
                />
                <NumberSetting
                  id="max-folds"
                  label="Maximum folds"
                  value={settings.default_max_folds}
                  min={1}
                  max={50}
                  onChange={value => updateSetting('default_max_folds', value)}
                />
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="account">
            <Card className="p-6 space-y-5">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Account</h2>
              </div>
              <ReadOnlyField label="Email" value={user?.email ?? ''} />
              <ReadOnlyField label="Full name" value={profile?.full_name ?? ''} />
              <ReadOnlyField label="Username" value={profile?.username ?? ''} />
              <ReadOnlyField label="Use case" value={profile?.use_case ?? ''} />
              <Button variant="destructive" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </Button>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card className="p-6 space-y-5 max-w-xl">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-primary" />
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Update Password</h2>
                  <p className="text-sm text-muted-foreground">OAuth-only accounts can continue using their provider</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={event => setNewPassword(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={event => setConfirmPassword(event.target.value)}
                />
              </div>
              <Button onClick={handlePasswordUpdate} disabled={updatingPassword}>
                {updatingPassword ? 'Updating...' : 'Update password'}
              </Button>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {!loading && (
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleCancel} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save settings'}
          </Button>
        </div>
      )}
    </div>
  );
}

function ThemeButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Sun;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-2 p-4 border rounded-lg ${
        active ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-sm">{label}</span>
    </button>
  );
}

function NumberSetting({
  id,
  label,
  max,
  min,
  onChange,
  value,
}: {
  id: string;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} disabled />
    </div>
  );
}