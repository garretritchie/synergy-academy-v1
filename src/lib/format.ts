export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function fullName(
  profile?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null,
) {
  return (
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    profile?.email ||
    "Unnamed user"
  );
}

export function formatDate(
  value?: string | null,
  options?: Intl.DateTimeFormatOptions,
) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(
    "en-BS",
    options ?? { dateStyle: "medium" },
  ).format(new Date(value));
}

export function formatDateTime(value?: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-BS", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error)
    return String(error.message);
  return "Something went wrong. Please try again.";
}
