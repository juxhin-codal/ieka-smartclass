"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { format, parseISO } from "date-fns"
import { fetchApi, fetchWithAuth } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import type { StazhDocument, StazhItem } from "@/lib/data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChevronDown, ChevronRight, Download, FileText, FolderOpen, RefreshCw, Trash2, Upload, Users } from "lucide-react"

type StudentSummaryApi = {
  id: string
  firstName: string
  lastName: string
  email: string
  memberRegistryNumber: string
  studentTrackingNumber?: number | null
  studentNumber?: string | null
  mentorId?: string | null
  isActive?: boolean
  attendedSessions?: number
  totalSessions?: number
}

type DocumentOrigin = "mentor" | "student" | "unknown"

const OWN_DOCS_PAGE_SIZE = 6
const STUDENTS_PAGE_SIZE = 5
const STUDENT_DOCS_PAGE_SIZE = 5

const MENTOR_UPLOADER_TAG = "[uploader:mentor]"
const STUDENT_UPLOADER_TAG = "[uploader:student]"

function isPdfFile(file: File | null) {
  if (!file) return false
  const fileName = file.name?.toLowerCase() ?? ""
  const mimeType = file.type?.toLowerCase() ?? ""
  return fileName.endsWith(".pdf") || mimeType === "application/pdf"
}

function getStudentDisplayId(student: StudentSummaryApi) {
  return (student.studentNumber ?? "").trim() || student.memberRegistryNumber
}

function isGuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function formatDate(value: string) {
  try {
    return format(parseISO(value), "dd MMM yyyy")
  } catch {
    return value
  }
}

function formatDateTime(value: string) {
  try {
    return format(parseISO(value), "dd MMM yyyy HH:mm")
  } catch {
    return value
  }
}

function parseDocumentOrigin(description?: string): { origin: DocumentOrigin; cleanDescription: string } {
  const raw = (description ?? "").trim()
  if (!raw) {
    return { origin: "unknown", cleanDescription: "" }
  }

  const lower = raw.toLowerCase()
  if (lower.startsWith(MENTOR_UPLOADER_TAG)) {
    return {
      origin: "mentor",
      cleanDescription: raw.slice(MENTOR_UPLOADER_TAG.length).trim(),
    }
  }

  if (lower.startsWith(STUDENT_UPLOADER_TAG)) {
    return {
      origin: "student",
      cleanDescription: raw.slice(STUDENT_UPLOADER_TAG.length).trim(),
    }
  }

  return { origin: "unknown", cleanDescription: raw }
}

function withDocumentOriginTag(description: string, origin: Exclude<DocumentOrigin, "unknown">) {
  const clean = parseDocumentOrigin(description).cleanDescription
  const tag = origin === "mentor" ? MENTOR_UPLOADER_TAG : STUDENT_UPLOADER_TAG
  return clean ? `${tag} ${clean}` : tag
}

function paginateArray<T>(items: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize
  return items.slice(start, start + pageSize)
}

function clampPage(page: number, totalItems: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  return Math.min(Math.max(page, 1), totalPages)
}

function formatRange(currentPage: number, totalItems: number, pageSize: number) {
  if (totalItems === 0) {
    return "0-0"
  }
  const start = (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, totalItems)
  return `${start}-${end}`
}

function SectionPagination({
  totalItems,
  page,
  pageSize,
  onPageChange,
}: {
  totalItems: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  if (totalItems <= pageSize) {
    return null
  }

  return (
    <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
      <p className="text-xs text-muted-foreground">
        {formatRange(page, totalItems, pageSize)} nga {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-2"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          Para
        </Button>
        <span className="text-xs text-muted-foreground">
          Faqja {page}/{totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-2"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Tjetra
        </Button>
      </div>
    </div>
  )
}

interface MentorStudentDocumentsCardProps {
  student: StudentSummaryApi
  stazhet: StazhItem[]
  allowUpload: boolean
  onRefresh: () => Promise<void>
  onOpenDocument: (doc: StazhDocument) => Promise<void>
  onDeleteDocument: (stazhId: string, documentId: string) => Promise<void>
  downloadingDocId: string | null
  deletingDocId: string | null
}

function MentorStudentDocumentsCard({
  student,
  stazhet,
  allowUpload,
  onRefresh,
  onOpenDocument,
  onDeleteDocument,
  downloadingDocId,
  deletingDocId,
}: MentorStudentDocumentsCardProps) {
  const [selectedStazhId, setSelectedStazhId] = useState(stazhet[0]?.id ?? "")
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadFileName, setUploadFileName] = useState("")
  const [uploadDescription, setUploadDescription] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const [docsPage, setDocsPage] = useState(1)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (stazhet.length === 0) {
      setSelectedStazhId("")
      return
    }

    const hasSelected = stazhet.some((item) => item.id === selectedStazhId)
    if (!hasSelected) {
      setSelectedStazhId(stazhet[0].id)
    }
  }, [selectedStazhId, stazhet])

  const selectedStazh = useMemo(
    () => stazhet.find((item) => item.id === selectedStazhId) ?? null,
    [selectedStazhId, stazhet]
  )

  const parsedDocuments = useMemo(() => {
    if (!selectedStazh) return [] as Array<StazhDocument & { cleanDescription: string; origin: DocumentOrigin }>

    return [...(selectedStazh.documents ?? [])]
      .map((doc) => {
        const parsed = parseDocumentOrigin(doc.description)
        return {
          ...doc,
          cleanDescription: parsed.cleanDescription,
          origin: parsed.origin,
        }
      })
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
  }, [selectedStazh])

  const mentorDocs = useMemo(
    () => parsedDocuments.filter((doc) => doc.origin === "mentor"),
    [parsedDocuments]
  )

  const studentDocs = useMemo(
    () => parsedDocuments.filter((doc) => doc.origin === "student" || doc.origin === "unknown"),
    [parsedDocuments]
  )

  useEffect(() => {
    setDocsPage((current) => clampPage(current, studentDocs.length, STUDENT_DOCS_PAGE_SIZE))
  }, [studentDocs.length])

  const pagedStudentDocs = useMemo(
    () => paginateArray(studentDocs, docsPage, STUDENT_DOCS_PAGE_SIZE),
    [docsPage, studentDocs]
  )

  async function handleUploadForStudent() {
    if (!allowUpload || !selectedStazh || !uploadFile) return

    setUploadError("")
    setUploading(true)
    try {
      const body = new FormData()
      body.append("file", uploadFile)

      if (uploadFileName.trim()) {
        body.append("fileName", uploadFileName.trim())
      }

      const taggedDescription = withDocumentOriginTag(uploadDescription.trim(), "mentor")
      if (taggedDescription.trim()) {
        body.append("description", taggedDescription)
      }

      await fetchApi(`/Stazh/${selectedStazh.id}/documents/upload`, {
        method: "POST",
        body,
      })

      setUploadFile(null)
      setUploadFileName("")
      setUploadDescription("")
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      await onRefresh()
    } catch (e: any) {
      setUploadError(e?.message ?? "Gabim gjatë ngarkimit të dokumentit.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {student.firstName} {student.lastName}
          </h3>
          <p className="text-xs text-muted-foreground">
            ID: {getStudentDisplayId(student)} • Regjistri: {student.memberRegistryNumber}
          </p>
          <p className="text-xs text-muted-foreground">
            {student.email}
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${student.isActive === false
              ? "bg-red-500/10 text-red-600"
              : "bg-green-500/10 text-green-600"
            }`}
        >
          {student.isActive === false ? "Inactive" : "Active"}
        </span>
      </div>

      {stazhet.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Nuk ka stazh të lidhur për këtë student.
        </p>
      ) : (
        <>
          {stazhet.length > 1 && (
            <div className="mt-3 flex flex-col gap-1.5">
              <Label className="text-xs">Zgjidh stazhin</Label>
              <select
                value={selectedStazhId}
                onChange={(event) => setSelectedStazhId(event.target.value)}
                className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {stazhet.map((stazh) => (
                  <option key={stazh.id} value={stazh.id}>
                    {stazh.title} ({formatDate(stazh.startDate)} - {formatDate(stazh.endDate)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedStazh && (
            <p className="mt-2 text-xs text-muted-foreground">
              Stazh: <span className="font-medium text-foreground">{selectedStazh.title}</span>
            </p>
          )}

          <div className="mt-4 rounded-lg border border-border p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Ngarko dokument për studentin
            </h4>

            {allowUpload ? (
              <>
                <div className="grid gap-2 md:grid-cols-3">
                  <Input
                    value={uploadFileName}
                    onChange={(event) => setUploadFileName(event.target.value)}
                    placeholder="Emri i dokumentit"
                    className="h-9"
                  />
                  <Input
                    value={uploadDescription}
                    onChange={(event) => setUploadDescription(event.target.value)}
                    placeholder="Përshkrimi"
                    className="h-9"
                  />
                  <Input
                    ref={fileInputRef}
                    type="file"
                    className="h-9"
                    accept="application/pdf,.pdf"
                    onChange={(event) => {
                      setUploadError("")
                      const nextFile = event.target.files?.[0] ?? null
                      if (nextFile && !isPdfFile(nextFile)) {
                        setUploadFile(null)
                        setUploadError("Lejohet vetëm skedar PDF.")
                        event.target.value = ""
                        return
                      }
                      setUploadFile(nextFile)
                    }}
                  />
                </div>

                <div className="mt-2 flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    className="gap-2"
                    disabled={uploading || !uploadFile || !selectedStazh}
                    onClick={() => void handleUploadForStudent()}
                  >
                    <Upload className="h-4 w-4" />
                    {uploading ? "Duke ngarkuar..." : "Ngarko"}
                  </Button>
                </div>

                {uploadError && <p className="mt-2 text-xs text-destructive">{uploadError}</p>}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Ngarkimi është i çaktivizuar për studentët jo aktiv.
              </p>
            )}
          </div>

          <div className="mt-4 rounded-lg border border-border p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Dokumente të ngarkuara nga mentori
            </h4>

            {mentorDocs.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nuk ka dokumente nga mentori.</p>
            ) : (
              <div className="mb-4 space-y-2">
                {mentorDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                        <p className="text-sm font-medium text-foreground truncate">{doc.fileName}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {doc.cleanDescription ? `${doc.cleanDescription} • ` : ""}
                        Ngarkuar nga mentori më {formatDateTime(doc.uploadedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5"
                        onClick={() => void onOpenDocument(doc)}
                        disabled={downloadingDocId === doc.id || deletingDocId === doc.id}
                      >
                        <Download className="h-3.5 w-3.5" />
                        {downloadingDocId === doc.id ? "Duke hapur..." : "Hap"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-destructive hover:text-destructive"
                        onClick={() => selectedStazh && void onDeleteDocument(selectedStazh.id, doc.id)}
                        disabled={deletingDocId === doc.id || downloadingDocId === doc.id || !selectedStazh}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {deletingDocId === doc.id ? "Duke fshirë..." : "Fshij"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Dokumente të ngarkuara nga studenti
            </h4>

            {studentDocs.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nuk ka dokumente nga studenti.</p>
            ) : (
              <>
                <div className="space-y-2">
                  {pagedStudentDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                          <p className="text-sm font-medium text-foreground truncate">{doc.fileName}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {doc.cleanDescription ? `${doc.cleanDescription} • ` : ""}
                          Ngarkuar më {formatDateTime(doc.uploadedAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5"
                          onClick={() => void onOpenDocument(doc)}
                          disabled={downloadingDocId === doc.id || deletingDocId === doc.id}
                        >
                          <Download className="h-3.5 w-3.5" />
                          {downloadingDocId === doc.id ? "Duke hapur..." : "Hap"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-destructive hover:text-destructive"
                          onClick={() => selectedStazh && void onDeleteDocument(selectedStazh.id, doc.id)}
                          disabled={deletingDocId === doc.id || downloadingDocId === doc.id || !selectedStazh}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {deletingDocId === doc.id ? "Duke fshirë..." : "Fshij"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <SectionPagination
                  totalItems={studentDocs.length}
                  page={docsPage}
                  pageSize={STUDENT_DOCS_PAGE_SIZE}
                  onPageChange={setDocsPage}
                />
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

interface MentorOwnDocument extends StazhDocument {
  stazhId: string
  studentId: string
  studentName: string
  studentCode: string
  cleanDescription: string
}

function MentorDocumentsPanel({
  userId,
  onOpenDocument,
  downloadingDocId,
  downloadError,
  onClearDownloadError,
}: {
  userId: string
  onOpenDocument: (doc: StazhDocument) => Promise<void>
  downloadingDocId: string | null
  downloadError: string
  onClearDownloadError: () => void
}) {
  const [stazhet, setStazhet] = useState<StazhItem[]>([])
  const [students, setStudents] = useState<StudentSummaryApi[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState("")

  const [showInactiveStudents, setShowInactiveStudents] = useState(false)
  const [ownDocsPage, setOwnDocsPage] = useState(1)
  const [activeStudentsPage, setActiveStudentsPage] = useState(1)
  const [inactiveStudentsPage, setInactiveStudentsPage] = useState(1)

  const loadMentorData = useCallback(
    async (silent = false) => {
      if (!isGuid(userId)) {
        setLoading(false)
        setRefreshing(false)
        setError("Përdoruesi aktual nuk ka identifikues të vlefshëm.")
        setStazhet([])
        setStudents([])
        return
      }

      onClearDownloadError()
      setDeleteError("")
      if (silent) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError("")

      try {
        const [stazhetResponse, studentsResponse] = await Promise.all([
          fetchApi(`/Stazh/mentor/${userId}`),
          fetchApi("/StudentTraining/students"),
        ])

        const sortedStazhet = [...(stazhetResponse as StazhItem[])].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )

        const sortedStudents = [...(studentsResponse as StudentSummaryApi[])].sort((a, b) =>
          `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
        )

        setStazhet(sortedStazhet)
        setStudents(sortedStudents)
      } catch (e: any) {
        setStazhet([])
        setStudents([])
        setError(e?.message ?? "Gabim gjatë ngarkimit të dokumenteve.")
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [onClearDownloadError, userId]
  )

  useEffect(() => {
    void loadMentorData()
  }, [loadMentorData])

  const handleDeleteDocument = useCallback(
    async (stazhId: string, documentId: string) => {
      if (!window.confirm("A dëshironi ta fshini këtë dokument?")) {
        return
      }

      setDeleteError("")
      setDeletingDocId(documentId)
      try {
        await fetchApi(`/Stazh/${stazhId}/documents/${documentId}`, {
          method: "DELETE",
        })
        await loadMentorData(true)
      } catch (e: any) {
        setDeleteError(e?.message ?? "Gabim gjatë fshirjes së dokumentit.")
      } finally {
        setDeletingDocId(null)
      }
    },
    [loadMentorData]
  )

  const stazhetByStudentId = useMemo(() => {
    const grouped = new Map<string, StazhItem[]>()
    stazhet.forEach((stazh) => {
      const current = grouped.get(stazh.studentId) ?? []
      current.push(stazh)
      grouped.set(stazh.studentId, current)
    })

    grouped.forEach((items) => {
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    })

    return grouped
  }, [stazhet])

  const studentRows = useMemo(
    () =>
      students.map((student) => ({
        student,
        stazhet: stazhetByStudentId.get(student.id) ?? [],
      })),
    [students, stazhetByStudentId]
  )

  const activeStudents = useMemo(
    () => studentRows.filter((row) => row.student.isActive !== false),
    [studentRows]
  )

  const inactiveStudents = useMemo(
    () => studentRows.filter((row) => row.student.isActive === false),
    [studentRows]
  )

  useEffect(() => {
    setOwnDocsPage((current) => clampPage(current, ownDocuments.length, OWN_DOCS_PAGE_SIZE))
  }, [stazhet, students])

  useEffect(() => {
    setActiveStudentsPage((current) => clampPage(current, activeStudents.length, STUDENTS_PAGE_SIZE))
  }, [activeStudents.length])

  useEffect(() => {
    setInactiveStudentsPage((current) => clampPage(current, inactiveStudents.length, STUDENTS_PAGE_SIZE))
  }, [inactiveStudents.length])

  const ownDocuments = useMemo(() => {
    const studentNameById = new Map(
      students.map((student) => [student.id, `${student.firstName} ${student.lastName}`.trim()])
    )
    const studentCodeById = new Map(
      students.map((student) => [student.id, getStudentDisplayId(student)])
    )

    const allDocuments: MentorOwnDocument[] = []
    stazhet.forEach((stazh) => {
      ;(stazh.documents ?? []).forEach((doc) => {
        const parsed = parseDocumentOrigin(doc.description)
        if (parsed.origin !== "mentor") {
          return
        }

        allDocuments.push({
          ...doc,
          stazhId: stazh.id,
          studentId: stazh.studentId,
          studentName: studentNameById.get(stazh.studentId) ?? stazh.studentId,
          studentCode: studentCodeById.get(stazh.studentId) ?? stazh.studentId,
          cleanDescription: parsed.cleanDescription,
        })
      })
    })

    return allDocuments.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
  }, [stazhet, students])

  const pagedOwnDocuments = useMemo(
    () => paginateArray(ownDocuments, ownDocsPage, OWN_DOCS_PAGE_SIZE),
    [ownDocsPage, ownDocuments]
  )

  const pagedActiveStudents = useMemo(
    () => paginateArray(activeStudents, activeStudentsPage, STUDENTS_PAGE_SIZE),
    [activeStudents, activeStudentsPage]
  )

  const pagedInactiveStudents = useMemo(
    () => paginateArray(inactiveStudents, inactiveStudentsPage, STUDENTS_PAGE_SIZE),
    [inactiveStudents, inactiveStudentsPage]
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            Dokumentet e mia
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Dokumentet e mia, dokumentet e studentëve aktiv dhe dokumentet e studentëve jo aktiv.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => void loadMentorData(true)}
          disabled={loading || refreshing}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading || refreshing ? "animate-spin" : ""}`} />
          Rifresko
        </Button>
      </div>

      {downloadError && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {downloadError}
        </p>
      )}

      {deleteError && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {deleteError}
        </p>
      )}

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">Duke ngarkuar...</div>
      ) : error ? (
        <div className="rounded-xl border border-border bg-card p-5 text-sm text-destructive">{error}</div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-1">Dokumentet e mia</h2>
            <p className="text-xs text-muted-foreground mb-3">Dokumentet që i keni ngarkuar vetë për studentët.</p>

            {ownDocuments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nuk keni dokumente të ngarkuara.</p>
            ) : (
              <>
                <div className="space-y-2">
                  {pagedOwnDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                          <p className="text-sm font-medium text-foreground truncate">{doc.fileName}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {doc.cleanDescription ? `${doc.cleanDescription} • ` : ""}
                          Studenti: {doc.studentName} ({doc.studentCode}) • Ngarkuar më {formatDateTime(doc.uploadedAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5"
                          onClick={() => void onOpenDocument(doc)}
                          disabled={downloadingDocId === doc.id || deletingDocId === doc.id}
                        >
                          <Download className="h-3.5 w-3.5" />
                          {downloadingDocId === doc.id ? "Duke hapur..." : "Hap"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-destructive hover:text-destructive"
                          onClick={() => void handleDeleteDocument(doc.stazhId, doc.id)}
                          disabled={deletingDocId === doc.id || downloadingDocId === doc.id}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {deletingDocId === doc.id ? "Duke fshirë..." : "Fshij"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <SectionPagination
                  totalItems={ownDocuments.length}
                  page={ownDocsPage}
                  pageSize={OWN_DOCS_PAGE_SIZE}
                  onPageChange={setOwnDocsPage}
                />
              </>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Studentë aktiv
            </h2>
            <p className="text-xs text-muted-foreground mb-3">
              Për secilin student aktiv: ngarkim dokumenti PDF dhe listë dokumentesh nga mentori dhe studenti.
            </p>

            {activeStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nuk ka studentë aktiv.</p>
            ) : (
              <>
                <div className="space-y-3">
                  {pagedActiveStudents.map((row) => (
                    <MentorStudentDocumentsCard
                      key={row.student.id}
                      student={row.student}
                      stazhet={row.stazhet}
                      allowUpload
                      onRefresh={() => loadMentorData(true)}
                      onOpenDocument={onOpenDocument}
                      onDeleteDocument={handleDeleteDocument}
                      downloadingDocId={downloadingDocId}
                      deletingDocId={deletingDocId}
                    />
                  ))}
                </div>

                <SectionPagination
                  totalItems={activeStudents.length}
                  page={activeStudentsPage}
                  pageSize={STUDENTS_PAGE_SIZE}
                  onPageChange={setActiveStudentsPage}
                />
              </>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <button
              type="button"
              onClick={() => setShowInactiveStudents((current) => !current)}
              className="flex w-full items-center justify-between rounded-md text-left"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {showInactiveStudents ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Studentë jo aktiv ({inactiveStudents.length})
              </span>
            </button>

            {showInactiveStudents && (
              <div className="mt-3">
                {inactiveStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nuk ka studentë jo aktiv.</p>
                ) : (
                  <>
                    <div className="space-y-3">
                      {pagedInactiveStudents.map((row) => (
                        <MentorStudentDocumentsCard
                          key={row.student.id}
                          student={row.student}
                          stazhet={row.stazhet}
                          allowUpload={false}
                          onRefresh={() => loadMentorData(true)}
                          onOpenDocument={onOpenDocument}
                          onDeleteDocument={handleDeleteDocument}
                          downloadingDocId={downloadingDocId}
                          deletingDocId={deletingDocId}
                        />
                      ))}
                    </div>

                    <SectionPagination
                      totalItems={inactiveStudents.length}
                      page={inactiveStudentsPage}
                      pageSize={STUDENTS_PAGE_SIZE}
                      onPageChange={setInactiveStudentsPage}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StudentDocumentsPanel({
  userId,
  onOpenDocument,
  downloadingDocId,
  downloadError,
  onClearDownloadError,
}: {
  userId: string
  onOpenDocument: (doc: StazhDocument) => Promise<void>
  downloadingDocId: string | null
  downloadError: string
  onClearDownloadError: () => void
}) {
  const [stazhet, setStazhet] = useState<StazhItem[]>([])
  const [selectedStazhId, setSelectedStazhId] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadFileName, setUploadFileName] = useState("")
  const [uploadDescription, setUploadDescription] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState("")

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const loadStudentStazhet = useCallback(async () => {
    if (!isGuid(userId)) {
      setLoading(false)
      setError("Përdoruesi aktual nuk ka identifikues të vlefshëm.")
      setStazhet([])
      return
    }

    onClearDownloadError()
    setDeleteError("")
    setLoading(true)
    setError("")

    try {
      const response = (await fetchApi(`/Stazh/student/${userId}`)) as StazhItem[]
      const sorted = [...(response ?? [])].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      setStazhet(sorted)
    } catch (e: any) {
      setStazhet([])
      setError(e?.message ?? "Gabim gjatë ngarkimit të dokumenteve.")
    } finally {
      setLoading(false)
    }
  }, [onClearDownloadError, userId])

  useEffect(() => {
    void loadStudentStazhet()
  }, [loadStudentStazhet])

  useEffect(() => {
    if (stazhet.length === 0) {
      setSelectedStazhId("")
      return
    }

    const exists = stazhet.some((stazh) => stazh.id === selectedStazhId)
    if (!exists) {
      setSelectedStazhId(stazhet[0].id)
    }
  }, [selectedStazhId, stazhet])

  const selectedStazh = useMemo(
    () => stazhet.find((stazh) => stazh.id === selectedStazhId) ?? null,
    [selectedStazhId, stazhet]
  )

  const documents = useMemo(() => {
    if (!selectedStazh) return [] as Array<StazhDocument & { cleanDescription: string; origin: DocumentOrigin }>

    return [...(selectedStazh.documents ?? [])]
      .map((doc) => {
        const parsed = parseDocumentOrigin(doc.description)
        return {
          ...doc,
          cleanDescription: parsed.cleanDescription,
          origin: parsed.origin,
        }
      })
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
  }, [selectedStazh])

  async function handleUpload() {
    if (!selectedStazh || !uploadFile) return

    setUploadError("")
    setUploading(true)
    try {
      const body = new FormData()
      body.append("file", uploadFile)

      if (uploadFileName.trim()) {
        body.append("fileName", uploadFileName.trim())
      }

      const taggedDescription = withDocumentOriginTag(uploadDescription.trim(), "student")
      if (taggedDescription.trim()) {
        body.append("description", taggedDescription)
      }

      await fetchApi(`/Stazh/${selectedStazh.id}/documents/upload`, {
        method: "POST",
        body,
      })

      setUploadFile(null)
      setUploadFileName("")
      setUploadDescription("")
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      await loadStudentStazhet()
    } catch (e: any) {
      setUploadError(e?.message ?? "Gabim gjatë ngarkimit të dokumentit.")
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteDocument = useCallback(
    async (documentId: string) => {
      if (!selectedStazh) {
        return
      }

      if (!window.confirm("A dëshironi ta fshini këtë dokument?")) {
        return
      }

      setDeleteError("")
      setDeletingDocId(documentId)
      try {
        await fetchApi(`/Stazh/${selectedStazh.id}/documents/${documentId}`, {
          method: "DELETE",
        })
        await loadStudentStazhet()
      } catch (e: any) {
        setDeleteError(e?.message ?? "Gabim gjatë fshirjes së dokumentit.")
      } finally {
        setDeletingDocId(null)
      }
    },
    [loadStudentStazhet, selectedStazh]
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-primary" />
          Dokumentet e mia
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Dokumentet e stazhit: ato të ngarkuara nga mentori dhe ato që ngarkoni ju.
        </p>
      </div>

      {downloadError && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {downloadError}
        </p>
      )}

      {deleteError && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {deleteError}
        </p>
      )}

      <div className="mb-5 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Stazhi</h2>
            <p className="text-xs text-muted-foreground">Zgjidh stazhin për të parë ose ngarkuar dokumente.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => void loadStudentStazhet()}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Rifresko
          </Button>
        </div>

        {loading ? (
          <p className="mt-3 text-sm text-muted-foreground">Duke ngarkuar...</p>
        ) : error ? (
          <p className="mt-3 text-sm text-destructive">{error}</p>
        ) : stazhet.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nuk u gjet asnjë stazh i lidhur me llogarinë tuaj.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {stazhet.length > 1 && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="studentStazhSelect" className="text-xs">
                  Zgjidh stazhin
                </Label>
                <select
                  id="studentStazhSelect"
                  value={selectedStazhId}
                  onChange={(event) => setSelectedStazhId(event.target.value)}
                  className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {stazhet.map((stazh) => (
                    <option key={stazh.id} value={stazh.id}>
                      {stazh.title} ({formatDate(stazh.startDate)} - {formatDate(stazh.endDate)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedStazh && (
              <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">{selectedStazh.title}</p>
                <p>
                  Periudha: {formatDate(selectedStazh.startDate)} - {formatDate(selectedStazh.endDate)}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mb-5 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground mb-2">Ngarko dokument PDF</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Emri i dokumentit (opsional)</Label>
            <Input
              value={uploadFileName}
              onChange={(event) => setUploadFileName(event.target.value)}
              placeholder="p.sh. Detyre-studenti.pdf"
              className="h-9"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Përshkrimi (opsional)</Label>
            <Input
              value={uploadDescription}
              onChange={(event) => setUploadDescription(event.target.value)}
              placeholder="Shënim i shkurtër"
              className="h-9"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Skedari</Label>
            <Input
              ref={fileInputRef}
              type="file"
              className="h-9"
              accept="application/pdf,.pdf"
              onChange={(event) => {
                setUploadError("")
                const nextFile = event.target.files?.[0] ?? null
                if (nextFile && !isPdfFile(nextFile)) {
                  setUploadFile(null)
                  setUploadError("Lejohet vetëm skedar PDF.")
                  event.target.value = ""
                  return
                }
                setUploadFile(nextFile)
              }}
            />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end">
          <Button
            type="button"
            className="gap-2"
            disabled={!selectedStazh || !uploadFile || uploading || loading}
            onClick={() => void handleUpload()}
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Duke ngarkuar..." : "Ngarko dokumentin"}
          </Button>
        </div>
        {uploadError && <p className="mt-2 text-xs text-destructive">{uploadError}</p>}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Dokumentet</h2>

        {loading ? (
          <p className="text-sm text-muted-foreground">Duke ngarkuar dokumentet...</p>
        ) : !selectedStazh ? (
          <p className="text-sm text-muted-foreground">Zgjidhni një stazh për të parë dokumentet.</p>
        ) : documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nuk ka dokumente për këtë stazh.</p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                    <p className="text-sm font-medium text-foreground truncate">{doc.fileName}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="font-medium text-foreground">
                      {doc.origin === "mentor" ? "Nga mentori" : doc.origin === "student" ? "Nga ju" : "Dokument"}
                    </span>
                    {" • "}
                    {doc.cleanDescription ? `${doc.cleanDescription} • ` : ""}
                    Ngarkuar më {formatDateTime(doc.uploadedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => void onOpenDocument(doc)}
                    disabled={downloadingDocId === doc.id || deletingDocId === doc.id}
                  >
                    <Download className="h-3.5 w-3.5" />
                    {downloadingDocId === doc.id ? "Duke hapur..." : "Hap"}
                  </Button>
                  {doc.origin === "student" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => void handleDeleteDocument(doc.id)}
                      disabled={deletingDocId === doc.id || downloadingDocId === doc.id}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {deletingDocId === doc.id ? "Duke fshirë..." : "Fshij"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function MyDocumentsView() {
  const { user } = useAuth()
  const isMentor = user?.role === "Mentor"
  const isStudent = user?.role === "Student"
  const userId = user?.id ?? ""

  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState("")
  const clearDownloadError = useCallback(() => {
    setDownloadError("")
  }, [])

  const handleOpenDocument = useCallback(async (doc: StazhDocument) => {
    setDownloadError("")
    setDownloadingDocId(doc.id)
    try {
      const response = await fetchWithAuth(doc.fileUrl, { method: "GET" })
      if (!response.ok) {
        throw new Error("Nuk u hap dokumenti.")
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = objectUrl
      link.download = doc.fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (e: any) {
      setDownloadError(e?.message ?? "Gabim gjatë hapjes së dokumentit.")
    } finally {
      setDownloadingDocId(null)
    }
  }, [])

  if (!isMentor && !isStudent) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
        <div className="rounded-xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
          Kjo faqe është e disponueshme vetëm për mentorë dhe studentë.
        </div>
      </div>
    )
  }

  if (isMentor) {
    return (
      <MentorDocumentsPanel
        userId={userId}
        onOpenDocument={handleOpenDocument}
        downloadingDocId={downloadingDocId}
        downloadError={downloadError}
        onClearDownloadError={clearDownloadError}
      />
    )
  }

  return (
    <StudentDocumentsPanel
      userId={userId}
      onOpenDocument={handleOpenDocument}
      downloadingDocId={downloadingDocId}
      downloadError={downloadError}
      onClearDownloadError={clearDownloadError}
    />
  )
}
