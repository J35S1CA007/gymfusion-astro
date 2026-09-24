export type PortalSection =
  | "dashboard"
  | "submissions"
  | "supporting-evidence"
  | "profile"
  | "profile-change-requests"
  | "account"
  | "eoi"
  | "help";

export type NavItem = {
  href: string;
  icon: string;
  label: string;
  section: PortalSection;
};

export const navItems: NavItem[] = [
  { href: "/dashboard", icon: "layout-dashboard", label: "Dashboard", section: "dashboard" },
  { href: "/submissions", icon: "file-text", label: "My Submissions", section: "submissions" },
  { href: "/supporting-evidence", icon: "paperclip", label: "Supporting Evidence", section: "supporting-evidence" },
  { href: "/profile", icon: "user-round", label: "My Profile", section: "profile" },
  { href: "/profile/change-requests", icon: "file-text", label: "Profile Change Requests", section: "profile-change-requests" },
  { href: "/account", icon: "settings-2", label: "Account", section: "account" },
  { href: "/eoi", icon: "file-text", label: "Expression of Interest", section: "eoi" },
  { href: "/help", icon: "circle-help", label: "Help & Support", section: "help" },
];

export const sectionCopy: Record<PortalSection, { title: string; description: string }> = {
  dashboard: {
    title: "Dashboard",
    description: "",
  },
  submissions: {
    title: "My Submissions",
    description: "Review your past submissions and current EOI milestones.",
  },
  "supporting-evidence": {
    title: "Supporting Evidence",
    description: "Track evidence requests and upload the items we have asked for.",
  },
  profile: {
    title: "My Profile",
    description: "Manage your current personal and contact details.",
  },
  "profile-change-requests": {
    title: "Profile Change Requests",
    description: "Review and track changes that require approval.",
  },
  account: {
    title: "Account",
    description: "Control your login, security, and privacy settings.",
  },
  eoi: {
    title: "EOI Parts 2-4",
    description: "Complete and review your EOI Parts 2-4 profiles.",
  },
  help: {
    title: "Help & Support",
    description: "Get help with the portal, your application, or accessibility needs.",
  },
};
