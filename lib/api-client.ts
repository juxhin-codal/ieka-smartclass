const DEFAULT_DIRECT_API_BASE_URL = "https://iekasmartclass-hthndtf8bjgrcvbn.italynorth-01.azurewebsites.net/api"

// Guard: once a 401 triggers a redirect, suppress all further API calls
let redirectingDueToAuth = false

function normalizeApiBaseUrl(rawBaseUrl?: string) {
    const baseUrl = rawBaseUrl?.trim()
    if (!baseUrl) {
        return "/api"
    }

    if (baseUrl.startsWith("http://") || baseUrl.startsWith("https://")) {
        const url = new URL(baseUrl)
        const normalizedPath = url.pathname.replace(/\/+$/, "")
        url.pathname = normalizedPath && normalizedPath !== "/"
            ? normalizedPath
            : "/api"
        return url.toString().replace(/\/+$/, "")
    }

    const normalizedBase = baseUrl.replace(/\/+$/, "")
    if (!normalizedBase || normalizedBase === "/") {
        return "/api"
    }

    return normalizedBase
}

function shouldUseDirectProductionApi(baseUrl: string) {
    if (baseUrl !== "/api" || typeof window === "undefined") {
        return false
    }

    const hostname = window.location.hostname.toLowerCase()
    return hostname === "iekaclass.vercel.app" || hostname.endsWith(".vercel.app")
}

function getApiBaseUrl() {
    const configuredBaseUrl = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL)
    if (shouldUseDirectProductionApi(configuredBaseUrl)) {
        return DEFAULT_DIRECT_API_BASE_URL
    }
    return configuredBaseUrl
}

export const API_BASE_URL = getApiBaseUrl()

const TRANSIENT_API_STATUSES = new Set([500, 502, 503, 504])

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function resolveApiUrl(endpoint: string) {
    if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
        return endpoint
    }

    const normalizedEndpoint = endpoint.replace(/^\/+/, "")
    const apiBaseUrl = getApiBaseUrl()
    if (apiBaseUrl.startsWith("http://") || apiBaseUrl.startsWith("https://")) {
        return new URL(normalizedEndpoint, `${apiBaseUrl}/`).toString()
    }

    return `${apiBaseUrl}/${normalizedEndpoint}`
}

function resolveAnyUrl(url: string) {
    // Convert absolute download URLs to relative path first (e.g. old Azure URLs stored in DB)
    const downloadMarker = "/api/LearningStorage/download/"
    let resolved = url
    const idx = url.indexOf(downloadMarker)
    if (idx > 0 && (url.startsWith("http://") || url.startsWith("https://"))) {
        resolved = url.substring(idx)
    }

    // On Vercel, route /api/ paths directly to production API (rewrites won't reach Docker backend)
    if (resolved.startsWith("/api/") && typeof window !== "undefined") {
        const base = getApiBaseUrl()
        if (base.startsWith("http")) {
            // Use the production API base, replacing /api with the resolved path
            const apiOrigin = new URL(base).origin
            return `${apiOrigin}${resolved}`
        }
        return `${window.location.origin}${resolved}`
    }

    return resolved
}

function buildHeaders(options: RequestInit = {}) {
    const providedHeaders = ((options.headers as Record<string, string>) || {})
    const isFormDataBody = typeof FormData !== "undefined" && options.body instanceof FormData
    const hasBody = options.body !== undefined && options.body !== null
    const headers: Record<string, string> = isFormDataBody
        ? { ...providedHeaders }
        : hasBody
            ? { "Content-Type": "application/json", ...providedHeaders }
            : { ...providedHeaders }

    let token = undefined
    if (typeof window !== "undefined") {
        token = localStorage.getItem("ieka-token")
    }

    if (token) {
        headers["Authorization"] = `Bearer ${token}`
    }

    return headers
}

async function extractApiError(response: Response) {
    let errorMessage = `API Error: ${response.status} ${response.statusText}`
    let responseText = ""

    try {
        const payload = await response.clone().json()
        const detail = payload?.detail
        const message = payload?.message
        const title = payload?.title
        errorMessage = detail || message || title || errorMessage
    } catch {
        try {
            responseText = await response.text()
            const trimmedText = responseText.trim()
            if (trimmedText) {
                errorMessage = trimmedText
            }
        } catch {
            // keep default error message when backend does not return a readable body
        }
    }

    const normalizedResponseText = responseText.replace(/\s+/g, " ").trim()
    const looksLikeAzureStartupError =
        normalizedResponseText.includes("HTTP Error 500.30") ||
        normalizedResponseText.includes("ASP.NET Core app failed to start")

    if (looksLikeAzureStartupError) {
        errorMessage = "API po niset pas gjumit të serverit. Provo përsëri pas disa sekondash."
    }

    return {
        errorMessage,
        isTransientStartupError: looksLikeAzureStartupError,
    }
}

function shouldRetryRequest(method: string, status: number, isTransientStartupError: boolean) {
    const normalizedMethod = method.toUpperCase()
    const canRetrySafely = normalizedMethod === "GET" || normalizedMethod === "HEAD"
    return canRetrySafely && (isTransientStartupError || TRANSIENT_API_STATUSES.has(status))
}

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
    if (redirectingDueToAuth) return new Promise<never>(() => { })

    const headers = buildHeaders(options)
    const requestUrl = resolveApiUrl(endpoint)
    const method = (options.method ?? "GET").toUpperCase()
    const maxAttempts = method === "GET" || method === "HEAD" ? 3 : 1

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        if (redirectingDueToAuth) return new Promise<never>(() => { })

        let response: Response

        try {
            response = await fetch(requestUrl, {
                ...options,
                headers,
                cache: "no-store",
            })
        } catch (error) {
            if (attempt < maxAttempts) {
                await delay(attempt * 1500)
                continue
            }
            throw error
        }

        if (response.ok) {
            if (response.status === 204) {
                return null
            }

            return response.json()
        }

        const { errorMessage, isTransientStartupError } = await extractApiError(response)

        if (response.status === 401) {
            if (typeof window !== "undefined") {
                redirectingDueToAuth = true
                localStorage.removeItem("ieka-token")
                window.location.replace("/")
                return new Promise<never>(() => { })
            }
        }

        if (attempt < maxAttempts && shouldRetryRequest(method, response.status, isTransientStartupError)) {
            await delay(attempt * 1500)
            continue
        }

        const apiError = new Error(errorMessage) as Error & { requestUrl?: string; status?: number }
        apiError.requestUrl = requestUrl
        apiError.status = response.status
        throw apiError
    }
}

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
    const headers = buildHeaders(options)
    return fetch(resolveAnyUrl(url), {
        ...options,
        headers,
        cache: "no-store",
    })
}
