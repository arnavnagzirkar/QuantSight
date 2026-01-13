import { useState } from 'react';
import { Save, Database, Bell, Shield, User, Moon, Sun, Monitor, LogOut } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { useTheme } from '../ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog';

export function Settings() {
  const { theme, setTheme } = useTheme();
  const { signOut, user, profile } = useAuth();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
    toast('Settings saved successfully');
  };

  const handleTestConnection = async (connectionType: string) => {
    toast(`Testing ${connectionType} connection...`);
    // Simulate connection test
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast.success(`${connectionType} connection successful`);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      toast.success('Logged out successfully');
      navigate('/');
    } catch (error) {
      toast.error('Failed to log out');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Configure your research platform and data connections
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="data">Data Sources</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <User className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold text-foreground">Account Information</h2>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email || ''} disabled />
              </div>

              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={profile?.full_name || ''} disabled />
              </div>

              <div className="space-y-2">
                <Label>Username</Label>
                <Input value={profile?.username || ''} disabled />
              </div>

              <div className="space-y-2">
                <Label>Use Case</Label>
                <Input 
                  value={profile?.use_case === 'personal' ? 'Personal Use' : 
                         profile?.use_case === 'company' ? 'Company Use' : 
                         profile?.use_case === 'student' ? 'Student/University/School Use' : ''} 
                  disabled 
                />
              </div>

              {profile?.use_case === 'company' && (
                <>
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input value={profile?.company_name || ''} disabled />
                  </div>

                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Input value={profile?.role || ''} disabled />
                  </div>
                </>
              )}

              <Separator />

              <div className="pt-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full sm:w-auto">
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure you want to sign out?</AlertDialogTitle>
                      <AlertDialogDescription>
                        You will need to sign in again to access your QuantSight account.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleLogout} disabled={isLoggingOut}>
                        {isLoggingOut ? 'Signing out...' : 'Sign Out'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="general" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Monitor className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold text-foreground">Appearance</h2>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <Label>Theme</Label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setTheme('light')}
                    className={`flex flex-col items-center gap-2 p-4 border-2 rounded-lg transition-colors ${
                      theme === 'light'
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Sun className="w-6 h-6" />
                    <span className="text-sm">Light</span>
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={`flex flex-col items-center gap-2 p-4 border-2 rounded-lg transition-colors ${
                      theme === 'dark'
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Moon className="w-6 h-6" />
                    <span className="text-sm">Dark</span>
                  </button>
                  <button
                    onClick={() => setTheme('system')}
                    className={`flex flex-col items-center gap-2 p-4 border-2 rounded-lg transition-colors ${
                      theme === 'system'
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Monitor className="w-6 h-6" />
                    <span className="text-sm">System</span>
                  </button>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select defaultValue="utc">
                    <SelectTrigger id="timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="utc">UTC</SelectItem>
                      <SelectItem value="est">Eastern Time (EST)</SelectItem>
                      <SelectItem value="pst">Pacific Time (PST)</SelectItem>
                      <SelectItem value="gmt">GMT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select defaultValue="en">
                    <SelectTrigger id="language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <User className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold text-foreground">User Preferences</h2>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" defaultValue="researcher@quantsight.com" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="default-universe">Default Universe</Label>
                <Select defaultValue="sp500">
                  <SelectTrigger id="default-universe">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sp500">S&P 500</SelectItem>
                    <SelectItem value="russell2000">Russell 2000</SelectItem>
                    <SelectItem value="nasdaq100">NASDAQ 100</SelectItem>
                    <SelectItem value="custom">Custom Universe</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Compact Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Show more data in less space
                  </p>
                </div>
                <Switch />
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Database className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold text-foreground">Backend API Connection</h2>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-url">API Base URL</Label>
                <div className="flex gap-2">
                  <Input 
                    id="api-url" 
                    placeholder="http://localhost:5000/api"
                    defaultValue="http://localhost:5000/api"
                  />
                  <Button 
                    variant="outline"
                    onClick={() => handleTestConnection('API')}
                  >
                    Test
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Flask backend endpoint for all API calls
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-key">API Key (Optional)</Label>
                <Input 
                  id="api-key" 
                  type="password"
                  placeholder="Enter API key if required"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Request Caching</Label>
                  <p className="text-sm text-muted-foreground">
                    Cache API responses to reduce load times
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-foreground">Market Data Providers</h3>
              <Button variant="outline" size="sm">Add Provider</Button>
            </div>

            <div className="space-y-4">
              <div className="p-4 border border-border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-chart-4 rounded-full" />
                    <div>
                      <p className="text-foreground">Yahoo Finance</p>
                      <p className="text-sm text-muted-foreground">Primary data source</p>
                    </div>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">Configure</Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleTestConnection('Yahoo Finance')}
                  >
                    Test Connection
                  </Button>
                </div>
              </div>

              <div className="p-4 border border-border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-muted-foreground/50 rounded-full" />
                    <div>
                      <p className="text-foreground">Alpha Vantage</p>
                      <p className="text-sm text-muted-foreground">Alternative data source</p>
                    </div>
                  </div>
                  <Switch />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">Configure</Button>
                  <Button variant="outline" size="sm">Test Connection</Button>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Data Refresh Settings</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="refresh-frequency">Auto-Refresh Frequency</Label>
                <Select defaultValue="daily">
                  <SelectTrigger id="refresh-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realtime">Real-time</SelectItem>
                    <SelectItem value="5min">Every 5 minutes</SelectItem>
                    <SelectItem value="15min">Every 15 minutes</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Cache Historical Data</Label>
                  <p className="text-sm text-muted-foreground">
                    Store historical data locally for faster access
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="models" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-foreground mb-6">Model Training Defaults</h2>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="default-model">Default Model Type</Label>
                <Select defaultValue="xgboost">
                  <SelectTrigger id="default-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="xgboost">XGBoost</SelectItem>
                    <SelectItem value="random-forest">Random Forest</SelectItem>
                    <SelectItem value="linear">Linear Regression</SelectItem>
                    <SelectItem value="ridge">Ridge Regression</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="train-days">Training Days</Label>
                  <Input id="train-days" type="number" defaultValue="252" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="test-days">Test Days</Label>
                  <Input id="test-days" type="number" defaultValue="63" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cv-folds">Cross-Validation Folds</Label>
                <Input id="cv-folds" type="number" defaultValue="5" />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-Retrain Models</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically retrain models on schedule
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Compute Resources</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="max-workers">Max Parallel Workers</Label>
                <Input id="max-workers" type="number" defaultValue="4" />
                <p className="text-sm text-muted-foreground">
                  Number of parallel jobs for model training
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="memory-limit">Memory Limit (GB)</Label>
                <Input id="memory-limit" type="number" defaultValue="8" />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>GPU Acceleration</Label>
                  <p className="text-sm text-muted-foreground">
                    Use GPU for faster training (if available)
                  </p>
                </div>
                <Switch />
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold text-foreground">Notification Preferences</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-border">
                <div>
                  <Label>Model Training Complete</Label>
                  <p className="text-sm text-muted-foreground">
                    Notify when model training finishes
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between py-3 border-b border-border">
                <div>
                  <Label>Signal Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Notify on new high-confidence signals
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between py-3 border-b border-border">
                <div>
                  <Label>Risk Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Notify when portfolio risk exceeds thresholds
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between py-3 border-b border-border">
                <div>
                  <Label>Data Update Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Notify when data refresh completes
                  </p>
                </div>
                <Switch />
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <Label>Experiment Results</Label>
                  <p className="text-sm text-muted-foreground">
                    Notify when experiments complete
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Email Notifications</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="researcher@stocksnow.com"
                  defaultValue="researcher@stocksnow.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="digest">Daily Digest</Label>
                <Select defaultValue="8am">
                  <SelectTrigger id="digest">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disabled">Disabled</SelectItem>
                    <SelectItem value="6am">6:00 AM</SelectItem>
                    <SelectItem value="8am">8:00 AM</SelectItem>
                    <SelectItem value="10am">10:00 AM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold text-foreground">Security Settings</h2>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input id="current-password" type="password" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input id="new-password" type="password" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input id="confirm-password" type="password" />
              </div>

              <Button>Update Password</Button>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Session Management</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-logout</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically log out after inactivity
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeout">Session Timeout (minutes)</Label>
                <Input id="timeout" type="number" defaultValue="30" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">API Keys</h3>
            
            <div className="space-y-4">
              <div className="p-4 bg-accent rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-foreground">Production API Key</span>
                  <Button variant="outline" size="sm">Regenerate</Button>
                </div>
                <code className="text-xs text-muted-foreground font-mono">
                  sk_prod_xxxxxxxxxxxxxxxxxxxxxxxx
                </code>
              </div>

              <div className="p-4 bg-accent rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-foreground">Development API Key</span>
                  <Button variant="outline" size="sm">Regenerate</Button>
                </div>
                <code className="text-xs text-muted-foreground font-mono">
                  sk_dev_xxxxxxxxxxxxxxxxxxxxxxxx
                </code>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-3">
        <Button variant="outline">Cancel</Button>
        <Button onClick={handleSaveSettings} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
