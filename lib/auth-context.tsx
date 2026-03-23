"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { type UserRole } from "@/lib/data"
import { API_BASE_URL } from "./api-client"

export interface AuthUser {
  id: string
  email: string
  name: string
  role: UserRole
  memberRegistryNumber: string
  phone?: string
  isActive?: boolean
  yearlyPaymentPaidYear?: number | null
  emailConfirmed?: boolean
  isPendingConfirmation?: boolean
}

export interface LoginOtpChallenge {
  challengeId: string
  emailHint?: string
  phoneHint?: string
  expiresInSeconds: number
}

interface AuthContextType {
  user: AuthUser | null
  isAuthenticated: boolean
  requestLoginOtp: (identifier: string, password: string) => Promise<{ success: boolean; challenge?: LoginOtpChallenge; error?: string }>
  verifyLoginOtp: (challengeId: string, code: string) => Promise<{ success: boolean; error?: string }>
  resendLoginOtp: (challengeId: string) => Promise<{ success: boolean; error?: string }>
  refreshProfile: () => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function parseSingleRole(rawRole: unknown): UserRole | null {
  if (typeof rawRole !== "string") return null

  const role = rawRole.trim().toLowerCase()
  if (role === "admin") return "Admin"
  if (role === "lecturer") return "Lecturer"
  if (role === "mentor") return "Mentor"
  if (role === "student") return "Student"
  if (role === "member" || role === "antar" || role === "anetar" || role === "anëtar") return "Member"
  return null
}

function normalizeUserRole(rawRole: unknown): UserRole {
  if (Array.isArray(rawRole)) {
    for (const item of rawRole) {
      const parsed = parseSingleRole(item)
      if (parsed) return parsed
    }
    return "Member"
  }

  return parseSingleRole(rawRole) ?? "Member"
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)

  const setUserFromAuthResponse = useCallback((data: any) => {
    setUser({
      id: data.userId || data.registryNumber || "",
      email: data.email,
      name: `${data.firstName} ${data.lastName}`,
      role: normalizeUserRole(data.role),
      memberRegistryNumber: data.registryNumber,
      phone: data.phone ?? undefined,
      isActive: typeof data.isActive === "boolean" ? data.isActive : undefined,
      yearlyPaymentPaidYear: typeof data.yearlyPaymentPaidYear === "number" ? data.yearlyPaymentPaidYear : null,
      emailConfirmed: typeof data.emailConfirmed === "boolean" ? data.emailConfirmed : undefined,
      isPendingConfirmation: typeof data.isPendingConfirmation === "boolean" ? data.isPendingConfirmation : undefined,
    })
  }, [])

  function parseBoolClaim(value: unknown): boolean | undefined {
    if (typeof value === "boolean") return value
    if (typeof value === "string") {
      if (value.toLowerCase() === "true") return true
      if (value.toLowerCase() === "false") return false
    }
    return undefined
  }

  function parseNumberClaim(value: unknown): number | null | undefined {
    if (value === null || value === undefined || value === "") return null
    const n = Number(value)
    return Number.isFinite(n) ? n : undefined
  }

  const refreshProfile = useCallback(async () => {
    const token = localStorage.getItem("ieka-token")
    if (!token) return

    try {
      const res = await fetch(`${API_BASE_URL}/Profile`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem("ieka-token")
          setUser(null)
        }
        return
      }

      const profile = await res.json()
      setUser((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          id: typeof profile.id === "string" && profile.id.trim() ? profile.id : prev.id,
          name: `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() || prev.name,
          email: profile.email ?? prev.email,
          role: profile.role ? normalizeUserRole(profile.role) : prev.role,
          memberRegistryNumber: profile.memberRegistryNumber ?? prev.memberRegistryNumber,
          isActive: typeof profile.isActive === "boolean" ? profile.isActive : prev.isActive,
          yearlyPaymentPaidYear: typeof profile.yearlyPaymentPaidYear === "number"
            ? profile.yearlyPaymentPaidYear
            : profile.yearlyPaymentPaidYear === null
              ? null
              : prev.yearlyPaymentPaidYear,
          emailConfirmed: typeof profile.emailConfirmed === "boolean" ? profile.emailConfirmed : prev.emailConfirmed,
          isPendingConfirmation: typeof profile.isPendingConfirmation === "boolean" ? profile.isPendingConfirmation : prev.isPendingConfirmation,
        }
      })
    } catch {
      // Ignore profile refresh errors and keep existing user state.
    }
  }, [])

  // Try to load user from token on mount
  useEffect(() => {
    const token = localStorage.getItem("ieka-token")
    if (token) {
      // Decode JWT safely (just simple payload extraction, no verify)
      try {
        const payloadStr = atob(token.split(".")[1])
        const payload = JSON.parse(payloadStr)

        setUser({
          id: payload.nameid || payload.sub || "",
          email: payload.email || "",
          name: payload.name || "",
          role: normalizeUserRole(
            payload.role
            ?? payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"]
            ?? payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role"]),
          memberRegistryNumber: payload.RegistryNumber || payload.sub || "",
          isActive: parseBoolClaim(payload.IsActive ?? payload.isActive),
          yearlyPaymentPaidYear: parseNumberClaim(payload.YearlyPaymentPaidYear ?? payload.yearlyPaymentPaidYear),
        })

        void refreshProfile()
      } catch {
        localStorage.removeItem("ieka-token")
      }
    }
  }, [refreshProfile])

  useEffect(() => {
    const handleFocus = () => {
      void refreshProfile()
    }

    const handleVisibility = () => {
      if (!document.hidden) {
        void refreshProfile()
      }
    }

    window.addEventListener("focus", handleFocus)
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [refreshProfile])

  const requestLoginOtp = useCallback(async (identifier: string, password: string): Promise<{ success: boolean; challenge?: LoginOtpChallenge; error?: string }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/Auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identifier, password }),
      })

      if (!response.ok) {
        let message = "Email ose fjalëkalim i pasaktë."
        try {
          const errorData = await response.json()
          message = errorData.message ?? message
        } catch {
          // keep default
        }
        return { success: false, error: message }
      }

      const data = await response.json()
      return {
        success: true,
        challenge: {
          challengeId: data.challengeId,
          emailHint: data.emailHint ?? undefined,
          phoneHint: data.phoneHint ?? undefined,
          expiresInSeconds: typeof data.expiresInSeconds === "number" ? data.expiresInSeconds : 0,
        },
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Gabim gjatë hyrjes." }
    }
  }, [])

  const verifyLoginOtp = useCallback(async (challengeId: string, code: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/Auth/verify-2fa`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ challengeId, code }),
      })

      if (!response.ok) {
        let message = "Kodi OTP është i pavlefshëm."
        try {
          const errorData = await response.json()
          message = errorData.message ?? message
        } catch {
          // keep default
        }
        return { success: false, error: message }
      }

      const data = await response.json()
      localStorage.setItem("ieka-token", data.token)
      setUserFromAuthResponse(data)
      void refreshProfile()
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Gabim gjatë hyrjes." }
    }
  }, [refreshProfile, setUserFromAuthResponse])

  const resendLoginOtp = useCallback(async (challengeId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/Auth/resend-2fa`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ challengeId }),
      })

      if (!response.ok) {
        let message = "Nuk u ridërgua OTP."
        try {
          const errorData = await response.json()
          message = errorData.message ?? message
        } catch {
          // keep default
        }
        return { success: false, error: message }
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Gabim gjatë ridërgimit të OTP." }
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem("ieka-token")
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, requestLoginOtp, verifyLoginOtp, resendLoginOtp, refreshProfile, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider")
  return context
}
