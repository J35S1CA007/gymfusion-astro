export function buildMemberSessionProjection(user: { name?: unknown; [key: string]: unknown } = {}) {
  const displayName = typeof user.name === "string" ? user.name.trim() : "";
  return { displayName: displayName || "Member" };
}
