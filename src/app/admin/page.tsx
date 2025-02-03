'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut, signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'react-hot-toast';
import { Search, Trash2, LogOut } from 'lucide-react';

interface License {
  id: string;
  key: string;
  isRedeemed: boolean;
  redeemedBy: string | null;
  redeemedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  maxUses: number | null;
  usedCount: number;
}

interface ExtendTimeUnit {
  value: number;
  unit: 'minutes' | 'hours' | 'days' | 'months';
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [licenses, setLicenses] = useState<License[]>([]);
  const [keyCount, setKeyCount] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [timeValue, setTimeValue] = useState(1);
  const [timeUnit, setTimeUnit] = useState<'minutes' | 'hours' | 'days' | 'months'>('days');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [maxUses, setMaxUses] = useState<number | null>(null);
  const [selectedKeyForExtension, setSelectedKeyForExtension] = useState<string | null>(null);
  const [extensionTimeValue, setExtensionTimeValue] = useState(1);
  const [extensionTimeUnit, setExtensionTimeUnit] = useState<'minutes' | 'hours' | 'days' | 'months'>('days');
  
  // Preview expiration
  const previewExpiration = () => {
    const now = new Date();
    const minutes = calculateExpirationMinutes(timeValue, timeUnit);
    const expirationDate = new Date(now.getTime() + minutes * 60 * 1000);
    return expirationDate.toLocaleString();
  };

  // Filter licenses based on search
  const filteredLicenses = licenses.filter(license => 
    license.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (license.redeemedBy?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  // Bulk delete
  const handleBulkDelete = async () => {
    if (!selectedKeys.length) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedKeys.length} keys?`)) return;

    try {
      const res = await fetch('/api/admin/keys/bulk-delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: selectedKeys }),
      });

      if (!res.ok) throw new Error('Failed to delete keys');
      
      toast.success(`Deleted ${selectedKeys.length} keys`);
      setSelectedKeys([]);
      fetchLicenses();
    } catch (_) {
      toast.error('Failed to delete keys');
    }
  };

  useEffect(() => {
    console.log('Session status:', status);
    console.log('Session data:', session);
    fetchLicenses();
  }, [session, status]);

  const calculateExpirationMinutes = (value: number, unit: 'minutes' | 'hours' | 'days' | 'months'): number => {
    switch (unit) {
      case 'minutes': return value;
      case 'hours': return value * 60;
      case 'days': return value * 24 * 60;
      case 'months': return value * 30 * 24 * 60;
      default: return value * 24 * 60;
    }
  };

  const generateKeys = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          count: keyCount, 
          expirationMinutes: calculateExpirationMinutes(timeValue, timeUnit),
          maxUses: maxUses 
        }),
      });

      if (!res.ok) throw new Error('Failed to generate keys');
      
      const data = await res.json();
      toast.success(`Generated ${data.keys.length} new license keys`);
      fetchLicenses();
    } catch (error) {
      toast.error('Failed to generate keys');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLicenses = async () => {
    try {
      console.log('Fetching with session:', session);
      const res = await fetch('/api/admin/keys');
      if (!res.ok) {
        const error = await res.json();
        console.error('License fetch error:', error);
        throw new Error('Failed to fetch licenses');
      }
      const data = await res.json();
      setLicenses(data.licenses);
    } catch (err) {
      console.error('Fetch error:', err);
      toast.error('Failed to fetch licenses');
    }
  };

  const handleExtendLicense = async (licenseId: string) => {
    try {
      const extensionMinutes = calculateExpirationMinutes(extensionTimeValue, extensionTimeUnit);
      const res = await fetch('/api/admin/keys/extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          licenseId,
          extensionMinutes 
        }),
      });

      if (!res.ok) throw new Error('Failed to extend license');
      
      toast.success('License extended successfully');
      setSelectedKeyForExtension(null);
      fetchLicenses();
    } catch (err) {
      toast.error('Failed to extend license');
    }
  };

  const handleTimeValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTimeValue(Number(e.target.value));
  };

  const handleTimeUnitChange = (value: ExtendTimeUnit['unit']) => {
    setTimeUnit(value);
  };

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    signIn('azure-ad', { 
      prompt: 'select_account',
      callbackUrl: '/admin'
    });
  };

  const handleRenewAll = async () => {
    try {
      const res = await fetch('/api/admin/renew-all', {
        method: 'POST',
      });

      if (!res.ok) throw new Error('Failed to renew subscriptions');
      
      toast.success('Successfully renewed all subscriptions');
    } catch (err) {
      console.error('Error renewing subscriptions:', err);
      toast.error('Failed to renew subscriptions');
    }
  };

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  if (!session) {
    return <div>Access denied</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">License Key Management</h1>
      
      <div className="bg-card p-6 border-2 border-border mb-6">
        <h2 className="text-lg font-semibold mb-4">Generate New Keys</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm mb-1">Number of Keys</label>
            <Input
              type="number"
              min="1"
              value={keyCount}
              onChange={(e) => setKeyCount(Number(e.target.value))}
            />
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Expiration Time</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="1"
                  value={timeValue}
                  onChange={handleTimeValueChange}
                  className="w-full"
                />
                <select
                  value={timeUnit}
                  onChange={(e) => handleTimeUnitChange(e.target.value as any)}
                  className="bg-background border-2 border-border px-3 py-1 text-sm w-32"
                >
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                  <option value="months">Months</option>
                </select>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Keys will expire at: {previewExpiration()}
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1">Usage Limit (Optional)</label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                min="1"
                value={maxUses || ''}
                onChange={(e) => setMaxUses(e.target.value ? Number(e.target.value) : null)}
                placeholder="Unlimited if empty"
                className="w-full"
              />
            </div>
            {maxUses && (
              <p className="text-sm text-muted-foreground mt-1">
                Key can be used {maxUses} times
              </p>
            )}
          </div>
        </div>
        <Button onClick={generateKeys} disabled={isLoading} className="w-full">
          {isLoading ? 'Generating...' : 'Generate Keys'}
        </Button>
      </div>

      <div className="bg-card p-6 border-2 border-border">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">License Keys</h2>
          <div className="flex gap-4">
            {selectedKeys.length > 0 && (
              <Button 
                variant="destructive" 
                onClick={handleBulkDelete}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete Selected ({selectedKeys.length})
              </Button>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search keys or emails..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-2 border-border">
            <thead className="bg-muted">
              <tr>
                <th className="w-8 px-4 py-2 border-b-2 border-border">
                  <input
                    type="checkbox"
                    checked={selectedKeys.length === filteredLicenses.length}
                    onChange={(e) => {
                      setSelectedKeys(e.target.checked 
                        ? filteredLicenses.map(l => l.id)
                        : []
                      );
                    }}
                  />
                </th>
                <th className="px-4 py-2 text-left border-b-2 border-border">Key</th>
                <th className="px-4 py-2 text-left border-b-2 border-border">Status</th>
                <th className="px-4 py-2 text-left border-b-2 border-border">Redeemed By</th>
                <th className="px-4 py-2 text-left border-b-2 border-border">Expires</th>
                <th className="px-4 py-2 text-left border-b-2 border-border">Created</th>
                <th className="px-4 py-2 text-left border-b-2 border-border">Usage</th>
                <th className="px-4 py-2 text-left border-b-2 border-border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLicenses.map((license) => (
                <tr key={license.id} className="border-b border-border">
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={selectedKeys.includes(license.id)}
                      onChange={(e) => {
                        setSelectedKeys(e.target.checked
                          ? [...selectedKeys, license.id]
                          : selectedKeys.filter(id => id !== license.id)
                        );
                      }}
                    />
                  </td>
                  <td className="px-4 py-2 font-mono">{license.key}</td>
                  <td className="px-4 py-2">
                    {license.isRedeemed ? 
                      <span className="text-destructive">Redeemed</span> : 
                      <span className="text-primary">Available</span>
                    }
                  </td>
                  <td className="px-4 py-2">{license.redeemedBy || '-'}</td>
                  <td className="px-4 py-2">
                    {license.expiresAt ? new Date(license.expiresAt).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-4 py-2">
                    {new Date(license.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    {license.maxUses ? 
                      `${license.usedCount} / ${license.maxUses}` : 
                      `${license.usedCount} / ∞`
                    }
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      {selectedKeyForExtension === license.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="1"
                            value={extensionTimeValue}
                            onChange={(e) => setExtensionTimeValue(Number(e.target.value))}
                            className="w-20"
                          />
                          <select
                            value={extensionTimeUnit}
                            onChange={(e) => setExtensionTimeUnit(e.target.value as any)}
                            className="bg-background border-2 border-border px-2 py-1 text-sm"
                          >
                            <option value="minutes">Minutes</option>
                            <option value="hours">Hours</option>
                            <option value="days">Days</option>
                            <option value="months">Months</option>
                          </select>
                          <Button
                            size="sm"
                            onClick={() => handleExtendLicense(license.id)}
                            className="whitespace-nowrap"
                          >
                            Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedKeyForExtension(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedKeyForExtension(license.id)}
                          className="whitespace-nowrap"
                        >
                          Extend Time
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Button 
        variant="destructive" 
        onClick={handleSignOut}
        className="mb-4"
      >
        <LogOut className="mr-2 h-4 w-4" />
        Switch Account
      </Button>

      <div className="mt-8">
        <Button 
          onClick={handleRenewAll}
          className="bg-green-600 hover:bg-green-700"
        >
          Renew All Subscriptions
        </Button>
      </div>
    </div>
  );
} 