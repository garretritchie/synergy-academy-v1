import { useRef, useState, type ChangeEvent } from "react";
import { Camera, Mail, Phone, Save, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Feedback";
import { UserAvatar } from "@/components/ui/UserAvatar";

const AVATAR_BUCKET = "profile-avatars";
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export function StudentProfile() {
  const { user, profile, roles, refreshProfile } = useAuth();
  const [firstName, setFirstName] = useState(profile?.first_name ?? "");
  const [lastName, setLastName] = useState(profile?.last_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSaved(false);
    setError("");
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        first_name: firstName,
        last_name: lastName,
        phone,
        bio,
      })
      .eq("id", user.id);
    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }
    await refreshProfile();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const fullName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    "User";
  const saveAvatarUrl = async (avatarUrl: string | null) => {
    if (!user) return;
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", user.id);
    if (updateError) throw updateError;
    await refreshProfile();
  };

  const handlePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user) return;
    setError("");
    if (![/^image\/(jpeg|png|webp)$/].some((rule) => rule.test(file.type))) {
      setError("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError("Profile photos must be 5 MB or smaller.");
      return;
    }

    setPhotoBusy(true);
    try {
      const avatarBlob = await prepareAvatar(file);
      const objectPath = `${user.id}/avatar.webp`;
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(objectPath, avatarBlob, {
          contentType: "image/webp",
          cacheControl: "3600",
          upsert: true,
        });

      if (!uploadError) {
        const { data } = supabase.storage
          .from(AVATAR_BUCKET)
          .getPublicUrl(objectPath);
        await saveAvatarUrl(`${data.publicUrl}?v=${Date.now()}`);
      } else if (import.meta.env.VITE_DEMO_MVP_MODE === "true") {
        await saveAvatarUrl(await blobToDataUrl(avatarBlob));
      } else {
        throw uploadError;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The profile photo could not be saved.",
      );
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    if (!user || !profile?.avatar_url) return;
    setPhotoBusy(true);
    setError("");
    try {
      await saveAvatarUrl(null);
      await supabase.storage
        .from(AVATAR_BUCKET)
        .remove([`${user.id}/avatar.webp`]);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The profile photo could not be removed.",
      );
    } finally {
      setPhotoBusy(false);
    }
  };

  return (
    <AppLayout>
      <div>
        <PageHeader
          title="Profile"
          subtitle="Manage your personal information"
        />

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Profile card */}
          <div className="card-elevated p-6 text-center">
            <div className="relative mx-auto w-fit">
              <UserAvatar profile={profile} size="xl" />
              <button
                type="button"
                className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-brand-600 text-white shadow-card transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                onClick={() => photoInput.current?.click()}
                disabled={photoBusy}
                aria-label={profile?.avatar_url ? "Replace profile photo" : "Upload profile photo"}
              >
                <Camera size={16} />
              </button>
              <input
                ref={photoInput}
                type="file"
                className="sr-only"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => void handlePhoto(event)}
              />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-ink-900">
              {fullName}
            </h3>
            <p className="break-words text-sm text-ink-500">{profile?.email}</p>
            <div className="mt-3 flex justify-center gap-2">
              {roles.map((role) => (
                <Badge key={role} variant="brand" className="capitalize">
                  {role}
                </Badge>
              ))}
            </div>
            <p className="mt-5 text-xs leading-5 text-ink-500">
              JPG, PNG, or WebP. Maximum 5 MB.
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => photoInput.current?.click()}
                disabled={photoBusy}
              >
                <Camera size={15} />
                {photoBusy
                  ? "Saving..."
                  : profile?.avatar_url
                    ? "Replace photo"
                    : "Upload photo"}
              </button>
              {profile?.avatar_url && (
                <button
                  type="button"
                  className="btn-secondary text-danger-600 hover:text-danger-700"
                  onClick={() => void removePhoto()}
                  disabled={photoBusy}
                >
                  <Trash2 size={15} /> Remove
                </button>
              )}
            </div>
          </div>

          {/* Edit form */}
          <div className="card lg:col-span-2">
            <div className="border-b border-ink-200/60 px-5 py-4">
              <h3 className="text-base font-semibold text-ink-900">
                Personal Information
              </h3>
            </div>
            <form onSubmit={handleSave} className="space-y-4 p-5">
              {error && <Alert>{error}</Alert>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label" htmlFor="firstName">
                    First name
                  </label>
                  <input
                    id="firstName"
                    className="input"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="lastName">
                    Last name
                  </label>
                  <input
                    id="lastName"
                    className="input"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="email">
                  Email
                </label>
                <div className="relative">
                  <Mail
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                  />
                  <input
                    id="email"
                    className="input pl-10 bg-ink-50"
                    value={profile?.email ?? ""}
                    disabled
                  />
                </div>
                <p className="mt-1 text-xs text-ink-400">
                  Email cannot be changed. Contact an administrator if needed.
                </p>
              </div>

              <div>
                <label className="label" htmlFor="phone">
                  Phone
                </label>
                <div className="relative">
                  <Phone
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
                  />
                  <input
                    id="phone"
                    className="input pl-10"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 242 ..."
                  />
                </div>
              </div>

              <div>
                <label className="label" htmlFor="bio">
                  Bio
                </label>
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
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                {saved && (
                  <span className="text-sm text-success-600">
                    Saved successfully!
                  </span>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

async function prepareAvatar(file: File) {
  const bitmap = await createImageBitmap(file);
  const edge = Math.min(bitmap.width, bitmap.height);
  const sourceX = Math.floor((bitmap.width - edge) / 2);
  const sourceY = Math.floor((bitmap.height - edge) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot prepare the selected image.");
  context.drawImage(bitmap, sourceX, sourceY, edge, edge, 0, 0, 512, 512);
  bitmap.close();
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("The selected image could not be prepared.")),
      "image/webp",
      0.84,
    );
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The selected image could not be read."));
    reader.readAsDataURL(blob);
  });
}
