import { useState } from 'react';
import { User, Mail, Phone, Save } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';

export function StudentProfile() {
  const { user, profile, roles, refreshProfile } = useAuth();
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [lastName, setLastName] = useState(profile?.last_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSaved(false);
    await supabase.from('profiles').update({
      first_name: firstName,
      last_name: lastName,
      phone,
      bio,
    }).eq('id', user.id);
    await refreshProfile();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'User';
  const initials = [profile?.first_name?.[0], profile?.last_name?.[0]].filter(Boolean).join('').toUpperCase() || 'U';

  return (
    <AppLayout>
      <div>
      <PageHeader title="Profile" subtitle="Manage your personal information" />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Profile card */}
        <div className="card-elevated p-6 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-100 text-2xl font-bold text-brand-700">
            {initials}
          </div>
          <h3 className="mt-4 text-lg font-semibold text-ink-900">{fullName}</h3>
          <p className="text-sm text-ink-500">{profile?.email}</p>
          <div className="mt-3 flex justify-center gap-2">
            {roles.map((role) => (
              <Badge key={role} variant="brand" className="capitalize">{role}</Badge>
            ))}
          </div>
        </div>

        {/* Edit form */}
        <div className="card lg:col-span-2">
          <div className="border-b border-ink-200/60 px-5 py-4">
            <h3 className="text-base font-semibold text-ink-900">Personal Information</h3>
          </div>
          <form onSubmit={handleSave} className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="firstName">First name</label>
                <input id="firstName" className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="lastName">Last name</label>
                <input id="lastName" className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="email">Email</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input id="email" className="input pl-10 bg-ink-50" value={profile?.email ?? ''} disabled />
              </div>
              <p className="mt-1 text-xs text-ink-400">Email cannot be changed. Contact an administrator if needed.</p>
            </div>

            <div>
              <label className="label" htmlFor="phone">Phone</label>
              <div className="relative">
                <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input id="phone" className="input pl-10" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 242 ..." />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="bio">Bio</label>
              <textarea
                id="bio"
                rows={4}
                className="input resize-none"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us a bit about yourself..."
              />
            </div>

            <div className="flex items-center gap-3">
              <button type="submit" disabled={saving} className="btn-primary">
                <Save size={16} />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              {saved && <span className="text-sm text-success-600">Saved successfully!</span>}
            </div>
          </form>
        </div>
      </div>
      </div>
    </AppLayout>
  );
}
