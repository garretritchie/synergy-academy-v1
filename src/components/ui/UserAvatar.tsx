import { useEffect, useState } from "react";
import type { Profile } from "@/types";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const sizeClasses: Record<AvatarSize, string> = {
  xs: "h-7 w-7 text-[10px]",
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-xs",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-2xl",
};

export function UserAvatar({
  profile,
  size = "md",
  className = "",
  decorative = false,
}: {
  profile?: Pick<Profile, "first_name" | "last_name" | "avatar_url"> | null;
  size?: AvatarSize;
  className?: string;
  decorative?: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const name =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    "User";
  const initials =
    [profile?.first_name?.[0], profile?.last_name?.[0]]
      .filter(Boolean)
      .join("")
      .toUpperCase() || "U";

  useEffect(() => setImageFailed(false), [profile?.avatar_url]);

  const shared = `${sizeClasses[size]} shrink-0 overflow-hidden rounded-full shadow-sm ring-1 ring-brand-200 ${className}`;

  if (profile?.avatar_url && !imageFailed) {
    return (
      <img
        src={profile.avatar_url}
        alt={decorative ? "" : `${name} profile photo`}
        aria-hidden={decorative || undefined}
        className={`${shared} bg-brand-50 object-cover`}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <span
      className={`${shared} flex items-center justify-center bg-gradient-to-br from-brand-100 to-brand-200/70 font-bold text-brand-800`}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : `${name} profile photo placeholder`}
    >
      {initials}
    </span>
  );
}
