"use client"

import Image from "next/image"
import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { NotificationCenter } from "@/components/notifications/notification-center"
import { LanguageToggle } from "@/components/i18n/language-toggle"
import { QuickQrScannerModal } from "@/components/qr/quick-qr-scanner-modal"
import { LayoutDashboard, Calendar, LogOut, Users, FileBarChart, Settings, Menu, X, GraduationCap, FileText, FolderOpen, UserCheck, ClipboardList, QrCode } from "lucide-react"

export type TabKey = "dashboard" | "events" | "myModules" | "myHistory" | "studies" | "attendance" | "myDocuments" | "myEvaluations" | "members" | "students" | "reports" | "settings"

interface AppHeaderProps {
  activeTab: TabKey
  onTabChange: (tab: TabKey) => void
}

const roleBadge: Record<string, string> = {
  Admin: "bg-blue-500/15 text-blue-400",
  Lecturer: "bg-purple-500/15 text-purple-400",
  Member: "bg-green-500/15 text-green-400",
  Mentor: "bg-teal-500/15 text-teal-400",
  Student: "bg-indigo-500/15 text-indigo-400",
}

const allTabs: { key: TabKey; labelKey: string; icon: typeof LayoutDashboard; roles: string[] }[] = [
  { key: "dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard, roles: ["Admin", "Lecturer"] },
  { key: "events", labelKey: "nav.modules", icon: Calendar, roles: ["Admin", "Lecturer"] },
  { key: "myModules", labelKey: "nav.myModules", icon: Calendar, roles: ["Member"] },
  { key: "myHistory", labelKey: "nav.myHistory", icon: FileText, roles: ["Member"] },
  { key: "studies", labelKey: "nav.studies", icon: GraduationCap, roles: ["Mentor", "Student"] },
  { key: "myEvaluations", labelKey: "nav.myEvaluations", icon: ClipboardList, roles: ["Student"] },
  { key: "attendance", labelKey: "nav.attendance", icon: UserCheck, roles: ["Mentor"] },
  { key: "myDocuments", labelKey: "nav.myDocuments", icon: FolderOpen, roles: ["Mentor", "Student"] },
  { key: "members", labelKey: "nav.members", icon: Users, roles: ["Admin"] },
  { key: "students", labelKey: "nav.students", icon: GraduationCap, roles: ["Admin"] },
  { key: "reports", labelKey: "nav.reports", icon: FileBarChart, roles: ["Admin"] },
]

const navLabelFallback: Record<string, string> = {
  "nav.dashboard": "Paneli",
  "nav.modules": "Modulet",
  "nav.myModules": "Modulet e Mia",
  "nav.myHistory": "Historia Ime",
  "nav.studies": "Studime",
  "nav.attendance": "Prezenca",
  "nav.myStudents": "Studentët e mi",
  "nav.myDocuments": "Dokumentet e mia",
  "nav.myEvaluations": "Vlerësimet",
  "nav.documents": "Dokumentat",
  "nav.members": "Anëtarë",
  "nav.students": "Studentë",
  "nav.reports": "Raporte",
  "nav.settings": "Cilësimet",
}

export function AppHeader({ activeTab, onTabChange }: AppHeaderProps) {
  const { user, logout } = useAuth()
  const { t } = useI18n()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [showQuickScanner, setShowQuickScanner] = useState(false)

  function navLabel(labelKey: string) {
    const translated = t(labelKey)
    return translated === labelKey ? (navLabelFallback[labelKey] ?? labelKey) : translated
  }

  function getTabLabelKey(tab: { key: TabKey; labelKey: string }) {
    if (tab.key === "studies" && user?.role === "Mentor") {
      return "nav.students"
    }
    if (tab.key === "myDocuments" && user?.role === "Mentor") {
      return "nav.documents"
    }
    return tab.labelKey
  }

  const visibleTabs = useMemo(() => {
    const role = user?.role ?? "Member"
    return allTabs.filter((tab) => tab.roles.includes(role))
  }, [user?.role])
  const defaultTab = visibleTabs[0]?.key ?? "events"
  const canAccessSettings = user?.role === "Admin" || user?.role === "Lecturer" || user?.role === "Member"
  const canUseQuickScanner = user?.role === "Member" || user?.role === "Student"

  function handleTabChange(tab: TabKey) {
    onTabChange(tab)
    setMenuOpen(false)
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 lg:px-8">
        {/* Left: Logo + Desktop nav */}
        <div className="flex items-center gap-4 lg:gap-8">
          <button
            onClick={() => handleTabChange(defaultTab)}
            className="flex items-center gap-2.5 transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded border-none appearance-none bg-transparent m-0 p-0"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ background: "linear-gradient(135deg, #1a3a6b, #2563eb)" }}>
              <Image src="/logo-transparent.png" alt="IEKA Logo" width={20} height={20} className="h-5 w-5 object-contain" />
            </div>
            <div className="hidden sm:block text-left whitespace-nowrap">
              <span className="text-sm font-bold tracking-tight text-foreground">IEKA</span>
              <span className="hidden lg:inline text-sm font-light text-muted-foreground"> SmartClass</span>
            </div>
          </button>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-0.5 sm:flex" role="navigation" aria-label="Main navigation">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${isActive
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="h-4 w-4" />
                  {navLabel(getTabLabelKey(tab))}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          {canUseQuickScanner && (
            <button
              onClick={() => {
                setMenuOpen(false)
                setShowQuickScanner(true)
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Hap skanerin QR"
              title="Skano QR"
            >
              <QrCode className="h-4 w-4" />
            </button>
          )}
          <LanguageToggle />
          {user && <NotificationCenter />}

          {/* Settings — desktop only */}
          {canAccessSettings && (
            <button
              onClick={() => handleTabChange("settings")}
              className={`hidden sm:flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${activeTab === "settings"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              aria-label={navLabel("nav.settings")}
            >
              <Settings className="h-4 w-4" />
            </button>
          )}

          {/* User info — desktop */}
          <div className="h-5 w-px bg-border hidden md:block" />
          {user && (
            <div className="relative hidden md:block group cursor-pointer">
              {/* Profile Icon with Initials */}
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 group-hover:ring-2 group-hover:ring-primary/20">
                {user.name?.split(" ").map(n => n.charAt(0)).join("").substring(0, 2).toUpperCase() || "U"}
              </div>

              {/* Hover Details Card */}
              <div className="absolute right-0 top-full mt-2 w-max min-w-[160px] invisible opacity-0 translate-y-1 group-hover:visible group-hover:opacity-100 group-hover:translate-y-0 z-50 transition-all duration-200 ease-in-out">
                <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-card p-3 shadow-xl">
                  <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate mb-1.5">{user.email}</p>
                  <span className={`w-fit text-[10px] px-1.5 py-0.5 rounded font-medium mb-3 ${roleBadge[user.role] ?? ""}`}>
                    {user.role === "Admin"
                      ? t("role.admin")
                      : user.role === "Lecturer"
                        ? t("role.lecturer")
                        : user.role === "Mentor"
                          ? t("role.mentor")
                          : user.role === "Student"
                            ? t("role.student")
                            : t("role.member")}
                  </span>
                  <div className="border-t border-border pt-2">
                    <button
                      onClick={() => logout?.()}
                      className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      {t("nav.logout")} <LogOut className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex sm:hidden h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            aria-label={menuOpen ? "Mbyll menynë" : "Hap menynë"}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile slide-down menu */}
      {menuOpen && (
        <div className="sm:hidden border-t border-border bg-card px-4 py-3 flex flex-col gap-1 shadow-lg">
          {/* Nav links */}
          {visibleTabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left ${isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {navLabel(getTabLabelKey(tab))}
              </button>
            )
          })}

          {canUseQuickScanner && (
            <button
              onClick={() => {
                setMenuOpen(false)
                setShowQuickScanner(true)
              }}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <QrCode className="h-4 w-4 shrink-0" />
              Skano QR
            </button>
          )}

          {/* Settings */}
          {canAccessSettings && (
            <button
              onClick={() => handleTabChange("settings")}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left ${activeTab === "settings"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
            >
              <Settings className="h-4 w-4 shrink-0" />
              {navLabel("nav.settings")}
            </button>
          )}

          {/* Logout + user info at bottom */}
          <div className="mt-1 border-t border-border pt-2 flex flex-col gap-1">
            <button
              onClick={() => { logout?.(); setMenuOpen(false) }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {t("nav.logout")}
            </button>
            {user && (
              <div className="flex items-center justify-end gap-2 px-3 pt-1 pb-0.5">
                <span className="text-xs text-muted-foreground truncate max-w-[160px]">{user.name}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${roleBadge[user.role] ?? ""}`}>
                  {user.role === "Admin"
                    ? t("role.admin")
                    : user.role === "Lecturer"
                      ? t("role.lecturer")
                      : user.role === "Mentor"
                        ? t("role.mentor")
                        : user.role === "Student"
                          ? t("role.student")
                          : t("role.member")}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {showQuickScanner && (
        <QuickQrScannerModal
          onClose={() => setShowQuickScanner(false)}
          onResolved={(route) => router.push(route)}
        />
      )}
    </header>
  )
}
