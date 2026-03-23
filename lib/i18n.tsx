"use client"

import { createContext, useContext, useEffect, useCallback, type ReactNode } from "react"

export type Lang = "sq" | "en"

// ── Translation dictionary ───────────────────────────────────────────────────
const translations: Record<string, Record<Lang, string>> = {
    // Navigation
    "nav.dashboard": { sq: "Paneli", en: "Dashboard" },
    "nav.modules": { sq: "Modulet", en: "Modules" },
    "nav.myModules": { sq: "Modulet e Mia", en: "My Modules" },
    "nav.myHistory": { sq: "Historia Ime", en: "My History" },
    "nav.studies": { sq: "Studime", en: "Studies" },
    "nav.attendance": { sq: "Prezenca", en: "Attendance" },
    "nav.myStudents": { sq: "Studentët e mi", en: "My students" },
    "nav.myDocuments": { sq: "Dokumentet e mia", en: "My documents" },
    "nav.documents": { sq: "Dokumentat", en: "Documents" },
    "nav.myEvaluations": { sq: "Vlerësimet", en: "Evaluations" },
    "nav.members": { sq: "Anëtarë", en: "Members" },
    "nav.students": { sq: "Studentë", en: "Students" },
    "nav.reports": { sq: "Raporte", en: "Reports" },
    "nav.settings": { sq: "Cilësimet", en: "Settings" },
    "nav.logout": { sq: "Dil", en: "Logout" },

    // Roles
    "role.admin": { sq: "Administrator", en: "Administrator" },
    "role.lecturer": { sq: "Ligjërues", en: "Lecturer" },
    "role.member": { sq: "Anëtar", en: "Member" },
    "role.mentor": { sq: "Mentor", en: "Mentor" },
    "role.student": { sq: "Student", en: "Student" },

    // Dashboard
    "dash.title": { sq: "Paneli – IEKA", en: "Dashboard – IEKA" },
    "dash.subtitle": { sq: "Vështrim i përgjithshëm i moduleve, anëtarëve dhe pajtueshmërisë", en: "Overview of modules, members, and compliance" },
    "dash.activeModules": { sq: "Module Aktive", en: "Active Modules" },
    "dash.registered": { sq: "Regjistruar", en: "Registered" },
    "dash.available": { sq: "Sesione Disponueshme", en: "Available Sessions" },
    "dash.noShow": { sq: "Shkalla e Mungesës", en: "No-Show Rate" },
    "dash.totalMembers": { sq: "Gjithsej Anëtarë", en: "Total Members" },
    "dash.compliant": { sq: "Pajtues CPD", en: "CPD Compliant" },
    "dash.nonCompliant": { sq: "Jo Pajtues", en: "Non-Compliant" },
    "dash.waitlist": { sq: "Në Listë Pritje", en: "On Waitlist" },
    "dash.sessionFill": { sq: "Statusi i Sesioneve", en: "Session Fill Rate (Active Modules)" },
    "dash.capacity": { sq: "Kapaciteti 45 vende/sesion", en: "Capacity 45 seats/session" },
    "dash.cpdActivity": { sq: "Aktiviteti CPD", en: "CPD Activity" },
    "dash.monthlyPart": { sq: "Pjesëmarrja mujore (2025–2026)", en: "Monthly participation (2025–2026)" },

    // Events
    "event.create": { sq: "Krijo Modul të Ri", en: "Create New Module" },
    "event.browse": { sq: "Modulet në Dispozicion", en: "Available Modules" },
    "event.manage": { sq: "Module", en: "Modules" },
    "event.browseBtn": { sq: "Shfleto Modulet", en: "Browse Modules" },
    "event.all": { sq: "Të Gjitha", en: "All" },
    "event.upcoming": { sq: "Aktive", en: "Active" },
    "event.past": { sq: "Të Kaluara", en: "Past" },
    "event.search": { sq: "Kërko module...", en: "Search modules..." },

    // Reservation
    "res.selectDate": { sq: "Zgjidh Datën", en: "Select Date" },
    "res.chooseSeat": { sq: "Zgjidh vendin", en: "Choose Seat" },
    "res.yourInfo": { sq: "Informacioni Juaj", en: "Your Info" },
    "res.confirmed": { sq: "Konfirmuar", en: "Confirmed" },
    "res.waitlistMsg": { sq: "Jeni në listën e pritjes. Do njoftoheni nëse lirohet një vend.", en: "You are on the waitlist. You will be notified if a seat becomes available." },
    "res.alreadyBooked": { sq: "Jeni tashmë të regjistruar!", en: "You are already registered!" },
    "res.duplicate": { sq: "Çdo anëtar mund të rezervojë vetëm një herë për modul.", en: "Each member can book only once per module." },

    // My Modules
    "my.title": { sq: "Modulet e Mia", en: "My Modules" },
    "my.subtitle": { sq: "Rezervimet, quiz-et dhe vlerësimet tuaja", en: "Your bookings, quizzes, and evaluations" },
    "my.bookMore": { sq: "Rezervo Modul Tjetër", en: "Book Another Module" },
    "my.activeBookings": { sq: "Rezervime Aktive", en: "Active Bookings" },
    "my.completed": { sq: "Module të Kryera", en: "Completed Modules" },
    "my.cpdEarned": { sq: "Orë CPD Fituar", en: "CPD Hours Earned" },
    "my.upcoming": { sq: "Të Ardhshme", en: "Upcoming" },
    "my.pastLabel": { sq: "Të Kaluara", en: "Past" },
    "my.cancelRes": { sq: "Anulo Rezervimin", en: "Cancel Booking" },
    "my.quiz": { sq: "Quiz Interaktiv", en: "Interactive Quiz" },
    "my.rateMod": { sq: "Vlerëso Modulin", en: "Rate Module" },
    "my.emptyTitle": { sq: "Nuk keni rezervime akoma", en: "No bookings yet" },
    "my.emptyDesc": { sq: "Shfleto modulet CPD në dispozicion dhe rezervo vendin tuaj.", en: "Browse available CPD modules and book your seat." },

    // Login
    "login.title": { sq: "Hyrje në Sistem", en: "System Login" },
    "login.subtitle": { sq: "Hyni me numrin e regjistrit dhe kodin tuaj", en: "Log in with your registry number and passcode" },
    "login.registry": { sq: "Numri i Regjistrit", en: "Registry Number" },
    "login.passcode": { sq: "Kodi i Hyrjes (Passcode)", en: "Passcode" },
    "login.phone": { sq: "Numri i Telefonit", en: "Phone Number" },
    "login.phoneReq": { sq: "I detyrueshëm për sigurinë e llogarisë dhe njoftimet SMS.", en: "Required for account security and notifications." },
    "login.continue": { sq: "Vazhdo", en: "Continue" },
    "login.submit": { sq: "Hyr në Sistem", en: "Log In" },
    "login.back": { sq: "← Kthehu", en: "← Back" },
    "login.forgotPassword": { sq: "Keni harruar fjalëkalimin?", en: "Forgot password?" },

    // Login Sidebar / Explanations
    "login.heroTitle": { sq: "Sistemi i Menaxhimit të Trajnimeve", en: "Training Management System" },
    "login.heroDesc": { sq: "Rezervoni vendin tuaj në sesionet e trajnimit, regjistroni prezencën tuaj me QR kod dhe ndiqni orët tuaja — të gjitha nga një platformë e vetme.", en: "Book your seat in training sessions, register attendance with QR codes, and track your hours — all from a single platform." },
    "login.feat1": { sq: "Check-in dhe pyetësorë interaktivë me QR kod", en: "QR code check-in and interactive surveys" },
    "login.feat2": { sq: "Raporte automatike të orëve dhe pikëve", en: "Automatic reports of hours and credits" },
    "login.feat3": { sq: "Një rezervim për modul • Lista e pritjes", en: "One booking per module • Waitlists" },
    "login.footer": { sq: "Platformë e sigurt • GDPR-Compliant • Verifikim me IEKA DB", en: "Secure platform • GDPR-Compliant • Verified by IEKA DB" },
    "login.phoneTitle": { sq: "Verifikimi i Numrit", en: "Phone Verification" },
    "login.phoneSubtitle": { sq: "Vendosni numrin tuaj të telefonit për siguri", en: "Enter your phone number for security" },
    "login.step1": { sq: "Kredencialet", en: "Credentials" },
    "login.step2": { sq: "Telefoni", en: "Phone" },
    "login.stepOtp": { sq: "Kodi OTP", en: "OTP" },
    "login.otpTitle": { sq: "Verifikimi OTP", en: "OTP Verification" },
    "login.otpSubtitle": { sq: "Vendosni kodin 6-shifror të dërguar në email dhe WhatsApp.", en: "Enter the 6-digit code sent to email and WhatsApp." },
    "login.otpSent": { sq: "Kodi OTP u dërgua me sukses.", en: "OTP code sent successfully." },
    "login.otpSentTo": { sq: "Kodi u dërgua te:", en: "Code sent to:" },
    "login.otp": { sq: "Kodi OTP", en: "OTP Code" },
    "login.otpHelp": { sq: "Nëse kodi ka skaduar, ridërgojeni.", en: "If the code expired, resend it." },
    "login.otpResend": { sq: "Ridërgo OTP", en: "Resend OTP" },
    "login.otpResent": { sq: "Kodi OTP u ridërgua.", en: "OTP code resent." },
    "login.errRegistry": { sq: "Ju lutem vendosni numrin e regjistrit", en: "Please enter your registry number" },
    "login.errPasscode": { sq: "Ju lutem vendosni kodin e hyrjes", en: "Please enter your passcode" },
    "login.errPhone": { sq: "Ju lutem vendosni numrin (min. 9 shifra)", en: "Please enter phone number (min 9 digits)" },
    "login.errOtp": { sq: "Ju lutem vendosni kodin OTP me 6 shifra.", en: "Please enter a valid 6-digit OTP code." },
    "login.errNotFound": { sq: "Numri i regjistrit nuk u gjet në databazë.", en: "Registry number not found in database." },
    "login.errWait": { sq: "Duke hyrë...", en: "Logging in..." },
    "login.errServer": { sq: "Diçka nuk funksionoi. Provoni përsëri.", en: "Something went wrong. Please try again." },

    // Forgot Password
    "forgot.title": { sq: "Keni harruar fjalëkalimin?", en: "Forgot Password?" },
    "forgot.subtitle": { sq: "Vendosni email-in për të marrë kodin sekret të rivendosjes.", en: "Enter your email to receive a reset secret code." },
    "forgot.email": { sq: "Adresa e email-it", en: "Email" },
    "forgot.submit": { sq: "Dërgo kodin", en: "Send code" },
    "forgot.sending": { sq: "Duke dërguar...", en: "Sending..." },
    "forgot.backToLogin": { sq: "← Kthehu te hyrja", en: "← Back to login" },
    "forgot.errRequired": { sq: "Email është i detyrueshëm.", en: "Email is required." },
    "forgot.errInvalid": { sq: "Vendosni një email të vlefshëm.", en: "Enter a valid email address." },
    "forgot.errSend": { sq: "Nuk u dërgua kodi i resetimit.", en: "Failed to send reset code." },
    "forgot.successDefault": { sq: "Kontrolloni email-in tuaj për kodin e resetimit.", en: "Check your email for the reset code." },
    "verifyReset.title": { sq: "Verifiko kodin sekret", en: "Verify Secret Code" },
    "verifyReset.subtitle": { sq: "Vendosni kodin 6-shifror të dërguar në email.", en: "Enter the 6-digit code sent to your email." },
    "verifyReset.code": { sq: "Kodi sekret", en: "Secret code" },
    "verifyReset.submit": { sq: "Verifiko kodin", en: "Verify code" },
    "verifyReset.verifying": { sq: "Duke verifikuar...", en: "Verifying..." },
    "verifyReset.resend": { sq: "Ridërgo kodin", en: "Resend code" },
    "verifyReset.resending": { sq: "Duke ridërguar...", en: "Resending..." },
    "verifyReset.resendSuccess": { sq: "Kodi u ridërgua me sukses.", en: "Code resent successfully." },
    "verifyReset.errMissingEmail": { sq: "Email mungon. Kthehuni te faqja e parë.", en: "Email is missing. Go back to the first step." },
    "verifyReset.errCodeRequired": { sq: "Kodi sekret është i detyrueshëm.", en: "Secret code is required." },
    "verifyReset.errCodeInvalid": { sq: "Kodi duhet të ketë 6 shifra.", en: "Code must be 6 digits." },
    "verifyReset.errVerify": { sq: "Verifikimi i kodit dështoi.", en: "Code verification failed." },
    "verifyReset.errResend": { sq: "Ridërgimi i kodit dështoi.", en: "Failed to resend code." },
    "reset.title": { sq: "Rivendos Fjalëkalimin", en: "Reset Password" },
    "reset.subtitle": { sq: "Vendosni fjalëkalimin e ri për llogarinë tuaj.", en: "Set your new password for your account." },
    "reset.newPassword": { sq: "Fjalëkalimi i ri", en: "New password" },
    "reset.confirmPassword": { sq: "Konfirmo fjalëkalimin e ri", en: "Confirm New Password" },
    "reset.submit": { sq: "Ruaj fjalëkalimin", en: "Save password" },
    "reset.saving": { sq: "Duke ruajtur...", en: "Saving..." },

    // Notifications
    "notif.title": { sq: "Njoftimet", en: "Notifications" },
    "notif.empty": { sq: "Asnjë njoftim i ri", en: "No new notifications" },
    "notif.markRead": { sq: "Shëno të lexuara", en: "Mark all read" },

    // Reports
    "rep.title": { sq: "Raporte IEKA CPD", en: "IEKA CPD Reports" },
    "rep.subtitle": { sq: "Prezenca, pajtueshmëri CPD dhe analitikë rezervimesh", en: "Attendance, CPD compliance, and booking analytics" },
    "rep.attendance": { sq: "Prezenca", en: "Attendance" },
    "rep.bookings": { sq: "Rezervime", en: "Bookings" },
    "rep.feedback": { sq: "Vlerësime", en: "Feedback" },
    "rep.export": { sq: "Eksporto", en: "Export" },

    // Certificate
    "cert.title": { sq: "Certifikatë Dixhitale", en: "Digital Certificate" },
    "cert.download": { sq: "Shkarko Certifikatën", en: "Download Certificate" },
    "cert.body": { sq: "Vërteton se anëtari ka përfunduar me sukses modulin e trajnimit CPD", en: "Certifies that the member has successfully completed the CPD training module" },

    // GDPR
    "gdpr.title": { sq: "Mbrojtja e të Dhënave", en: "Data Protection" },
    "gdpr.desc": { sq: "Ne ruajmë të dhënat tuaja në përputhje me GDPR. Të dhënat përdoren vetëm për menaxhimin e trajnimeve CPD.", en: "We store your data in compliance with GDPR. Data is used only for CPD training management." },
    "gdpr.accept": { sq: "Pranoj", en: "Accept" },
    "gdpr.learnMore": { sq: "Mëso më shumë", en: "Learn More" },

    // Common
    "common.close": { sq: "Mbyll", en: "Close" },
    "common.save": { sq: "Ruaj", en: "Save" },
    "common.cancel": { sq: "Anulo", en: "Cancel" },
    "common.confirm": { sq: "Konfirmo", en: "Confirm" },
    "common.back": { sq: "Kthehu", en: "Back" },
    "common.yes": { sq: "Po", en: "Yes" },
    "common.no": { sq: "Jo", en: "No" },
    "common.sessions": { sq: "sesione", en: "sessions" },
    "common.seats": { sq: "vende", en: "seats" },
}

// ── Context ──────────────────────────────────────────────────────────────────
interface I18nContextType {
    lang: Lang
    setLang: (lang: Lang) => void
    t: (key: string) => string
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)
const LOCKED_LANG: Lang = "sq"

export function I18nProvider({ children }: { children: ReactNode }) {
    const lang = LOCKED_LANG

    useEffect(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem("ieka-lang", LOCKED_LANG)
        }
    }, [])

    const setLang = useCallback((_l: Lang) => {
        if (typeof window !== "undefined") {
            localStorage.setItem("ieka-lang", LOCKED_LANG)
        }
    }, [])

    const t = useCallback((key: string): string => {
        const entry = translations[key]
        if (!entry) return key
        return entry[lang] ?? entry["sq"] ?? key
    }, [lang])

    return (
        <I18nContext.Provider value={{ lang, setLang, t }}>
            {children}
        </I18nContext.Provider>
    )
}

export function useI18n() {
    const ctx = useContext(I18nContext)
    if (!ctx) throw new Error("useI18n must be used within I18nProvider")
    return ctx
}
