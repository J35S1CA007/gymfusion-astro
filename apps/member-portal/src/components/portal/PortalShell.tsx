"use client";

import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Separator, Sheet, SheetContent, SheetTrigger } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ChevronDown, CircleHelp, FileText, HelpCircle, LayoutDashboard, LogOut, Menu, Paperclip, Settings2, UserRound } from "lucide-react";
import { navItems, type PortalSection, sectionCopy } from "@/lib/portal";

const iconMap = { "layout-dashboard": LayoutDashboard, "file-text": FileText, paperclip: Paperclip, "user-round": UserRound, "settings-2": Settings2, "circle-help": CircleHelp } as const;

export type PortalMember = { displayName: string; imageSrc?: string; imageAlt?: string; initials?: string };

type PortalShellProps = { active: PortalSection; children: React.ReactNode; member: PortalMember; onLogout?: () => void; logoutHref?: string; eyebrow?: string; title?: string; description?: string; headerActions?: React.ReactNode; compact?: boolean };

function ShellNav({ active }: { active: PortalSection }) {
  return (
    <nav aria-label="Portal navigation" className="space-y-2">
      {navItems.map((item) => {
        const Icon = iconMap[item.icon as keyof typeof iconMap];
        return <a key={item.href} href={item.href} aria-current={active === item.section ? "page" : undefined} className={cn("flex items-center gap-4 rounded-md px-4 py-4 text-[1.02rem] font-medium transition-colors", active === item.section ? "bg-white text-black" : "text-white/90 hover:bg-white/10 hover:text-white")}><Icon className="size-6 shrink-0" aria-hidden="true" /><span>{item.label}</span></a>;
      })}
    </nav>
  );
}

export default function PortalShell({ active, children, member, onLogout, logoutHref, eyebrow = "GYMFUSION MEMBERS PORTAL", title, description, headerActions, compact = false }: PortalShellProps) {
  const copy = sectionCopy[active];
  const pageTitle = title ?? copy.title;
  const pageDescription = description ?? copy.description;

  return <div className="min-h-screen bg-[#f5f5f3] text-black">
    <div className="mx-auto flex min-h-screen w-full max-w-[1600px] bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.08)]">
      <aside className="hidden w-[280px] shrink-0 flex-col bg-black px-6 py-7 text-white xl:flex">
        <a href="/dashboard" className="mb-8 block"><img src="/assets/branding/gf-members-portal-transparent%20logo.png" alt="GYMFUSION Members Portal" className="h-auto w-[220px] max-w-full" /></a>
        <ShellNav active={active} />
        <div className="mt-auto pt-8 text-xs tracking-[0.24em] text-white/55">© 2026 GYMFUSION</div>
      </aside>
      <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-white">
        <header className="sticky top-0 z-20 border-b border-black/10 bg-white/95 backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 xl:hidden">
              <Sheet><SheetTrigger asChild><Button variant="ghost" size="icon-sm" className="rounded-md border border-black/15" aria-label="Open navigation"><Menu className="size-5" aria-hidden="true" /></Button></SheetTrigger><SheetContent side="left" className="w-[86vw] max-w-[340px] border-white/10 bg-black p-0 text-white"><div className="flex h-full flex-col px-5 py-6"><a href="/dashboard" className="mb-8 block"><img src="/assets/branding/gf-members-portal-transparent%20logo.png" alt="GYMFUSION Members Portal" className="h-auto w-[200px] max-w-full" /></a><ShellNav active={active} /></div></SheetContent></Sheet>
              <a href="/dashboard" className="block" aria-label="Dashboard"><img src="/assets/branding/vibrant_gf_spiral_transparent.png" alt="GYMFUSION" className="size-10" /></a>
            </div>
            <div className="hidden min-w-0 flex-1 xl:block">
              <div className="max-w-[720px]">
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-black/45">{eyebrow}</div>
                <h1 className="font-heading text-[clamp(1.9rem,2vw,3rem)] font-black leading-[0.95] tracking-[-0.05em]">{pageTitle}</h1>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-3">{headerActions}<Button asChild variant="ghost" className="hidden h-11 rounded-md px-4 text-[0.95rem] font-medium xl:inline-flex"><a href="/help"><CircleHelp className="mr-2 size-5" aria-hidden="true" />Help &amp; Support</a></Button><Separator orientation="vertical" className="hidden h-8 bg-black/10 xl:block" /><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="rounded-md px-3 py-2" aria-label={`Open member menu for ${member.displayName}`}><Avatar className="size-10 rounded-md">{member.imageSrc ? <AvatarImage src={member.imageSrc} alt={member.imageAlt ?? member.displayName} /> : null}<AvatarFallback>{member.initials ?? "?"}</AvatarFallback></Avatar><span className="hidden text-[0.98rem] font-medium sm:inline-flex">Hi, {member.displayName}</span><ChevronDown className="hidden size-4 xl:inline-flex" aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="min-w-56 rounded-md p-2"><DropdownMenuItem asChild><a href="/help" className="flex items-center gap-3"><HelpCircle className="size-4" aria-hidden="true" />Help &amp; Support</a></DropdownMenuItem>{logoutHref ? <DropdownMenuItem asChild><a href={logoutHref} className="flex items-center gap-3"><LogOut className="size-4" aria-hidden="true" />Log Out</a></DropdownMenuItem> : onLogout ? <DropdownMenuItem onSelect={onLogout} className="flex items-center gap-3"><LogOut className="size-4" aria-hidden="true" />Log Out</DropdownMenuItem> : null}</DropdownMenuContent></DropdownMenu></div>
          </div>
        </header>
        <main className={cn("flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8", compact && "lg:px-10")}><div className="mx-auto flex w-full max-w-[1120px] flex-col gap-5"><div className="xl:hidden"><div className="text-[0.8rem] font-semibold uppercase tracking-[0.2em] text-black/45">{eyebrow}</div><h1 className="font-heading mt-1 text-[clamp(2rem,7vw,3.6rem)] font-black leading-[0.92] tracking-[-0.06em]">{pageTitle}</h1>{pageDescription ? <p className="mt-2 text-[1rem] text-black/68">{pageDescription}</p> : null}</div>{pageDescription ? <div className="hidden rounded-2xl border border-black/10 bg-[#fafaf8] px-5 py-4 text-sm text-black/68 xl:block">{pageDescription}</div> : null}{children}</div></main>
      </div>
    </div>
    <footer className="border-t border-black/10 bg-black px-4 py-4 text-sm text-white/80 sm:px-6 xl:hidden"><div className="mx-auto max-w-[1600px]">© 2026 GYMFUSION</div></footer>
  </div>;
}
