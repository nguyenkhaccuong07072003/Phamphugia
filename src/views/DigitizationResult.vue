<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import api from '../api'

interface TableColumn {
  key: string
  label: string
  type?: string
  options?: string[]
}

interface Question {
  key: string
  label: string
  type?: string
  columns?: string[]
  children?: Question[]
  tableColumns?: TableColumn[]
  formula?: string
}

interface Submission {
  id: number
  template_id: number
  answers: Record<string, any>
  generated_file_url: string
  status: string
  /** Tên file gợi ý (cùng logic với tải xuống): "Tên mẫu", "Tên mẫu (1)", ... */
  display_filename?: string
  display_filename_pdf?: string
  display_filename_base?: string
  created_at?: string | null
  createdAt?: string | null
  template: {
    id: number
    name: string
    slug: string
    template_type: 'docx' | 'xlsx'
    questions: Question[]
    icon: string
  }
}

const route = useRoute()
const router = useRouter()
const submission = ref<Submission | null>(null)
const loading = ref(false)
const previewLoading = ref(false)
const previewError = ref('')
/** Blob URL cho iframe xem trước PDF (Word → PDF server-side). */
const pdfPreviewUrl = ref<string | null>(null)
/** Tăng mỗi lần gán PDF mới — ép Vue tạo lại iframe (tránh viewer giữ trạng thái cũ). */
const pdfPreviewFrameKey = ref(0)
const spreadsheetData = ref<any[][]>([])
const spreadsheetHeaders = ref<string[]>([])
const activeTab = ref<'preview' | 'answers'>('preview')

/** Tránh tải PDF trùng khi vừa xem trước vừa in / tải PDF; tái dùng blob trong phiên. */
let cachedPdfBlob: Blob | null = null
let cachedPdfSubmissionId: number | null = null
let pdfInflight: Promise<Blob> | null = null

function isPdfRequestCanceled(e: unknown): boolean {
  return (
    axios.isCancel(e) ||
    (e as { code?: string })?.code === 'ERR_CANCELED' ||
    (e as { name?: string })?.name === 'CanceledError'
  )
}

function clearPdfBlobCache() {
  cachedPdfBlob = null
  cachedPdfSubmissionId = null
  pdfInflight = null
}

/**
 * Dev: mặc định /print qua proxy Vite (cùng origin, tránh CORS).
 * Gọi thẳng backend: `VITE_DIRECT_PRINT_BACKEND=true` (+ CORS trong phamphugia-be).
 * Treo pending lần đầu: đã xử lý phía server — hàng đợi Word (docxToPdf), tránh 2 Word song song.
 */
function backendOriginForLongPrintRequest(): string {
  if (import.meta.env.PROD) return ''
  if (import.meta.env.VITE_DIRECT_PRINT_BACKEND === 'true') {
    const override = import.meta.env.VITE_API_ORIGIN as string | undefined
    if (override?.trim()) return override.replace(/\/$/, '')
    const port = (import.meta.env.VITE_BACKEND_PORT as string | undefined) || '3001'
    if (typeof window === 'undefined') return ''
    return `${window.location.protocol}//${window.location.hostname}:${port}`
  }
  return ''
}

function submissionPrintRequestUrl(sid: number): string {
  const path = `/admin/digitization/submissions/${sid}/print`
  const origin = backendOriginForLongPrintRequest()
  return origin ? `${origin.replace(/\/$/, '')}/api${path}` : path
}

/** Một mức timeout đủ cho Word; không dùng “timeout cực ngắn + retry” làm cách tải nhanh. */
const PDF_PRINT_TIMEOUT_MS = 120_000
/** Chỉ giữa các lần retry mạng — không làm nhanh Word, chỉ giảm chờ thừa khi lỗi tạm thời. */
const PDF_RETRY_DELAY_MS = 350
const PDF_MAX_ATTEMPTS = 3

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isPrintAttemptRetryable(error: unknown): boolean {
  if (isPdfRequestCanceled(error)) return false
  if (!axios.isAxiosError(error)) {
    const code = (error as { code?: string })?.code
    return ['ECONNABORTED', 'ERR_NETWORK', 'ETIMEDOUT', 'ECONNRESET'].includes(code || '')
  }
  const status = error.response?.status
  if (status == null) return true
  if (status === 400 || status === 401 || status === 403 || status === 404) return false
  // 500 = lỗi Word/PDF phía server — retry không giúp, chỉ làm chờ 3× timeout
  if (status === 500) return false
  return [408, 429, 502, 503, 504].includes(status)
}

/** Lấy message từ JSON lỗi (blob) để hiển thị thay vì chỉ "Không thể tải". */
async function messageFromPdfAxiosError(e: unknown): Promise<string> {
  if (!axios.isAxiosError(e) || !e.response?.data) {
    return (e as Error)?.message || 'Không thể tải xem trước PDF'
  }
  const data = e.response.data as Blob | unknown
  const status = e.response.status
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    const ct = (e.response.headers['content-type'] || '').toLowerCase()
    if (ct.includes('application/json')) {
      try {
        const text = await data.text()
        const j = JSON.parse(text) as { message?: string }
        if (j.message) return String(j.message)
        return text.slice(0, 400)
      } catch {
        return `Lỗi máy chủ (${status})`
      }
    }
  }
  return `Lỗi máy chủ (${status})`
}

async function blobLooksLikePdf(blob: Blob): Promise<boolean> {
  if (blob.size < 5) return false
  const buf = await blob.slice(0, 5).arrayBuffer()
  return new TextDecoder('latin1').decode(buf).startsWith('%PDF')
}

/** Một request PDF cho mỗi submission; các thao tác khác dùng chung blob đã tải. */
async function getSubmissionPdfBlob(): Promise<Blob> {
  const sub = submission.value
  if (!sub || sub.template.template_type !== 'docx') {
    throw new Error('Không có PDF cho mẫu này')
  }
  const sid = sub.id
  if (cachedPdfSubmissionId === sid && cachedPdfBlob) {
    return cachedPdfBlob
  }
  if (pdfInflight) return pdfInflight

  pdfInflight = (async () => {
    let lastError: unknown
    for (let attempt = 1; attempt <= PDF_MAX_ATTEMPTS; attempt++) {
      if (attempt > 1) {
        await delay(PDF_RETRY_DELAY_MS)
      }
      try {
        const res = await api.get(submissionPrintRequestUrl(sid), {
          responseType: 'blob',
          params: { _t: Date.now() },
          headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
          timeout: PDF_PRINT_TIMEOUT_MS,
        })
        const blob = res.data as Blob
        const ct = (res.headers['content-type'] || '').toLowerCase()

        if (ct.includes('application/json')) {
          const text = await blob.text()
          lastError = new Error(text.slice(0, 200) || 'Lỗi PDF')
          if (attempt < PDF_MAX_ATTEMPTS) continue
          throw lastError
        }

        if (!blob.size) {
          lastError = new Error('PDF rỗng')
          if (attempt < PDF_MAX_ATTEMPTS) continue
          throw lastError
        }

        if (!(await blobLooksLikePdf(blob))) {
          lastError = new Error('Phản hồi không phải PDF')
          if (attempt < PDF_MAX_ATTEMPTS) continue
          throw lastError
        }

        cachedPdfBlob = blob
        cachedPdfSubmissionId = sid
        return blob
      } catch (e) {
        lastError = e
        if (isPdfRequestCanceled(e)) throw e
        if (!isPrintAttemptRetryable(e) || attempt >= PDF_MAX_ATTEMPTS) {
          throw e
        }
      }
    }
    throw lastError
  })().finally(() => {
    pdfInflight = null
  })
  return pdfInflight
}

/** Tên hiển thị cho PDF (viewer Chrome/Edge đọc từ File.name khi dùng blob URL). */
function pdfDisplayFilename(): string {
  const sub = submission.value
  if (!sub) return 'document.pdf'
  return (
    sub.display_filename_pdf ??
    `${sub.template.name}_${sub.id}.pdf`
  )
}

function createPdfObjectUrl(blob: Blob): string {
  const name = pdfDisplayFilename()
  const file = new File([blob], name, { type: 'application/pdf' })
  return URL.createObjectURL(file)
}

async function fetchSubmission() {
  loading.value = true
  clearPdfBlobCache()
  revokePdfPreview()
  try {
    const { data } = await api.get(`/admin/digitization/submissions/${route.params.submissionId}`)
    submission.value = data.data
  } catch (e) {
    console.error('Failed to fetch submission:', e)
  } finally {
    loading.value = false
  }
  if (submission.value) {
    await loadPreview()
  }
}

function revokePdfPreview() {
  if (pdfPreviewUrl.value) {
    try {
      URL.revokeObjectURL(pdfPreviewUrl.value)
    } catch {
      /* ignore */
    }
    pdfPreviewUrl.value = null
  }
}

async function loadPreview() {
  if (!submission.value) return
  previewLoading.value = true
  previewError.value = ''
  revokePdfPreview()
  try {
    if (submission.value.template.template_type === 'docx') {
      await loadPdfPreview()
    } else {
      await renderXlsx()
    }
  } catch (e) {
    if (isPdfRequestCanceled(e)) return
    console.error('Preview failed:', e)
    previewError.value = await messageFromPdfAxiosError(e)
  } finally {
    previewLoading.value = false
  }
}

/** Xem trước bằng PDF (dùng chung blob với In / Tải PDF). */
async function loadPdfPreview() {
  if (!submission.value) return
  const blob = await getSubmissionPdfBlob()
  pdfPreviewUrl.value = createPdfObjectUrl(blob)
  pdfPreviewFrameKey.value += 1
}

async function renderXlsx() {
  if (!submission.value) return
  const response = await axios.get(submission.value.generated_file_url, { responseType: 'arraybuffer' })
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(new Uint8Array(response.data), { type: 'array' })

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return

  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return
  const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })

  if (jsonData.length === 0) return

  const headers = (jsonData[0] as any[]).map((h: any, i: number) =>
    h != null ? String(h) : `Cột ${i + 1}`
  )
  const data = jsonData.slice(1).map((row: any[]) =>
    row.map((cell: any) => (cell != null ? String(cell) : ''))
  )

  spreadsheetHeaders.value = headers
  spreadsheetData.value = data
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(
    new File([blob], filename, { type: blob.type || 'application/octet-stream' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

async function downloadWord() {
  if (!submission.value) return
  try {
    const response = await api.get(
      `/admin/digitization/submissions/${submission.value.id}/download`,
      { responseType: 'blob' },
    )
    const ext = submission.value.template.template_type
    const filename =
      submission.value.display_filename ??
      `${submission.value.template.name}_${submission.value.id}.${ext}`
    triggerBlobDownload(new Blob([response.data]), filename)
  } catch (e) {
    console.error('Download failed:', e)
    alert('Lỗi khi tải file')
  }
}

async function downloadPdf() {
  if (!submission.value || submission.value.template.template_type !== 'docx') return
  try {
    const blob = await getSubmissionPdfBlob()
    const filename =
      submission.value.display_filename_pdf ??
      `${submission.value.template.name}_${submission.value.id}.pdf`
    triggerBlobDownload(blob, filename)
  } catch (e) {
    console.error('Download PDF failed:', e)
    alert('Lỗi khi tải PDF. Bạn có thể tải file Word và lưu thành PDF trên máy.')
  }
}

// In: PDF trong iframe ẩn — dùng chung blob đã tải (không gọi API lần hai).
function printPreview() {
  if (!submission.value) return
  if (submission.value.template.template_type !== 'docx') return

  void getSubmissionPdfBlob()
    .then((blob) => {
      const pdfUrl = createPdfObjectUrl(blob)

      const iframe = document.createElement('iframe')
      iframe.setAttribute('title', pdfDisplayFilename())
      iframe.style.cssText =
        'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;'

      const removeIframe = () => {
        try {
          iframe.remove()
        } catch {
          /* ignore */
        }
      }

      const cleanupBlob = () => {
        try {
          URL.revokeObjectURL(pdfUrl)
        } catch {
          /* ignore */
        }
      }

      const tryPrint = () => {
        try {
          const w = iframe.contentWindow
          if (w) {
            w.focus()
            let finished = false
            const done = () => {
              if (finished) return
              finished = true
              removeIframe()
              window.setTimeout(cleanupBlob, 2000)
            }
            w.addEventListener('afterprint', done, { once: true })
            w.print()
            // Một số trình duyệt không bắn afterprint cho PDF trong iframe — dọn sau tối đa 5 phút.
            window.setTimeout(done, 300_000)
            return
          }
        } catch {
          /* fall through */
        }
        removeIframe()
        window.open(pdfUrl, '_blank', 'noopener,noreferrer')
        window.setTimeout(cleanupBlob, 120_000)
      }

      iframe.onload = () => {
        // PDF plugin cần một nhịp render trước khi print (Chrome/Edge).
        window.setTimeout(tryPrint, 600)
      }

      iframe.src = pdfUrl
      document.body.appendChild(iframe)
    })
    .catch((e) => {
      console.error('Print failed:', e)
      void downloadWord()
      alert('Không thể in trên web. Hệ thống sẽ tải Word để bạn in bằng Microsoft Word.')
    })
}

function goToResubmit() {
  if (!submission.value) return
  router.push({ name: 'digitization-form', params: { slug: submission.value.template.slug } })
}

function formatDate(dateStr: string) {
  // Tránh hiển thị "Invalid Date" khi backend trả về thiếu/null hoặc format không ISO.
  if (!dateStr) return 'Chưa rõ'

  // Một số backend/MySQL trả về kiểu: "YYYY-MM-DD HH:mm:ss" (không có "T"/timezone)
  // -> đổi sang ISO để Date.parse ổn định, rồi parse như UTC để chuyển sang Asia/Ho_Chi_Minh.
  let normalized = dateStr.trim()
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(normalized)) {
    normalized = normalized.replace(' ', 'T') + 'Z'
  } else if (/^\d{4}-\d{2}-\d{2}T/.test(normalized) && !/[zZ]|[+\-]\d{2}:?\d{2}$/.test(normalized)) {
    // ISO nhưng không có timezone
    normalized = normalized + 'Z'
  }

  const d = new Date(normalized)
  if (Number.isNaN(d.getTime())) return 'Chưa rõ'

  return d.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getAnswer(key: string): any {
  return submission.value?.answers?.[key]
}

function displayValue(val: any): string {
  if (val === undefined || val === null || val === '') return 'Chưa điền'
  return String(val)
}

function isEmpty(val: any): boolean {
  return val === undefined || val === null || val === ''
}

onMounted(fetchSubmission)

watch(
  () => route.params.submissionId,
  (newId, oldId) => {
    if (newId === oldId || newId == null) return
    void fetchSubmission()
  },
)

onBeforeUnmount(() => {
  revokePdfPreview()
  clearPdfBlobCache()
})

// Không cần xử lý print-docx-only nữa (đã chuyển sang in theo luồng Word).
</script>

<template>
  <div class="w-full py-10 px-10 max-sm:px-3 max-sm:py-4">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="text-gray-400">Đang tải...</div>
    </div>

    <!-- Not found -->
    <div v-else-if="!submission" class="text-center py-20">
      <span class="material-icon text-5xl text-gray-300">error_outline</span>
      <p class="text-gray-400 mt-3">Không tìm thấy kết quả</p>
    </div>

    <div v-else>
      <!-- Header -->
      <div class="mb-6 result-page-nav">
        <button class="btn-back" @click="router.back()">
          <span class="material-icon text-base">arrow_back</span> Quay lại
        </button>
      </div>

      <!-- Success banner -->
      <div class="success-banner mb-6">
        <div class="flex items-center gap-3">
          <div class="success-icon">
            <span class="material-icon" style="font-size: 28px; color: #15803d">check_circle</span>
          </div>
          <div>
            <h1 class="text-lg font-bold" style="color: #1a3a5c">{{ submission.template.name }}</h1>
            <p class="text-sm text-gray-500">
              Văn bản đã được tạo thành công
              <span class="text-gray-400">&middot;</span>
              {{ formatDate(submission.created_at ?? (submission as any).createdAt) }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <button class="btn-history" @click="router.push({ name: 'digitization-history' })">
            <span class="material-icon text-base">history</span>
            Lịch sử
          </button>
          <button class="btn-resubmit" @click="goToResubmit">
            <span class="material-icon text-base">edit</span>
            Điền lại
          </button>
          <button
            v-if="submission.template.template_type === 'docx'"
            class="btn-print"
            @click="printPreview"
          >
            <span class="material-icon text-base">print</span>
            In
          </button>
          <div
            v-if="submission.template.template_type === 'docx'"
            class="download-btn-group"
          >
            <button type="button" class="btn-download" @click="downloadWord">
              <span class="material-icon text-base">description</span>
              Tải Word
            </button>
            <button type="button" class="btn-download btn-download-pdf" @click="downloadPdf">
              <span class="material-icon text-base">picture_as_pdf</span>
              Tải PDF
            </button>
          </div>
          <button
            v-else
            type="button"
            class="btn-download"
            @click="downloadWord"
          >
            <span class="material-icon text-base">download</span>
            Tải Excel
          </button>
        </div>
      </div>
      <!-- Tab toggle -->
      <div class="tab-bar mb-6">
        <button
          class="tab-btn"
          :class="{ 'tab-active': activeTab === 'preview' }"
          @click="activeTab = 'preview'"
        >
          <span class="material-icon text-base">visibility</span>
          {{ submission.template.template_type === 'docx' ? 'Xem trước (PDF)' : 'Xem trước văn bản' }}
        </button>
        <button
          class="tab-btn"
          :class="{ 'tab-active': activeTab === 'answers' }"
          @click="activeTab = 'answers'"
        >
          <span class="material-icon text-base">list_alt</span>
          Thông tin đã điền
        </button>
      </div>

      <!-- Document preview tab -->
      <div v-show="activeTab === 'preview'" class="result-card">
        <div v-if="previewLoading" class="preview-overlay">
          <div class="text-gray-400">Đang tải xem trước...</div>
        </div>

        <div v-if="previewError && !previewLoading" class="preview-overlay">
          <span class="material-icon text-4xl text-gray-300">warning</span>
          <p class="text-gray-400 mt-2">{{ previewError }}</p>
          <p class="text-sm text-gray-400 mt-1">Bạn vẫn có thể tải file về máy để xem</p>
        </div>

        <iframe
          v-if="submission.template.template_type === 'docx' && pdfPreviewUrl"
          :key="`pdf-${submission.id}-${pdfPreviewFrameKey}`"
          :src="pdfPreviewUrl"
          class="pdf-preview-iframe"
          :title="submission.display_filename_pdf || 'Xem trước PDF'"
        />

        <div v-show="submission.template.template_type === 'xlsx'" class="xlsx-container">
          <div v-if="spreadsheetData.length > 0" class="overflow-x-auto">
            <table class="xlsx-table">
              <thead>
                <tr>
                  <th v-for="(header, hi) in spreadsheetHeaders" :key="hi" class="xlsx-th">{{ header }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, ri) in spreadsheetData" :key="ri" class="xlsx-row">
                  <td v-for="(cell, ci) in row" :key="ci" class="xlsx-td">{{ cell }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else-if="!previewLoading && !previewError" class="text-center py-10 text-gray-400">
            Không có dữ liệu
          </div>
        </div>
      </div>

      <!-- Answers tab -->
      <div v-show="activeTab === 'answers'" class="result-card">
        <div class="answers-list">
          <template v-for="q in submission.template.questions" :key="q.key">
            <!-- GROUP: section header + children -->
            <template v-if="q.type === 'group'">
              <div class="answer-group-header">
                <span class="answer-group-label">{{ q.label }}</span>
              </div>
              <div
                v-for="child in (q.children || [])"
                :key="child.key"
                class="answer-row answer-row-child"
              >
                <div class="answer-content">
                  <span class="answer-label">{{ child.label }}</span>
                  <!-- Child textarea HTML -->
                  <div v-if="child.type === 'textarea' && getAnswer(child.key)" class="answer-html" v-html="getAnswer(child.key)"></div>
                  <!-- Child table -->
                  <template v-else-if="(child.type === 'table' || child.type === 'dynamic_table') && Array.isArray(getAnswer(child.key))">
                    <div v-if="getAnswer(child.key).length > 0" class="answer-table-wrap">
                      <table class="answer-table">
                        <thead>
                          <tr>
                            <th class="at-th" style="width:40px">STT</th>
                            <th v-for="col in (child.tableColumns || child.columns || [])" :key="typeof col === 'string' ? col : col.key" class="at-th">{{ typeof col === 'string' ? col : col.label }}</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="(row, ri) in getAnswer(child.key)" :key="ri">
                            <td class="at-td at-stt">{{ Number(ri) + 1 }}</td>
                            <td v-for="col in (child.tableColumns || child.columns || [])" :key="typeof col === 'string' ? col : col.key" class="at-td">{{ row[typeof col === 'string' ? col : col.key] || '' }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <span v-else class="answer-value answer-empty">Chưa điền</span>
                  </template>
                  <!-- Child normal -->
                  <span v-else class="answer-value" :class="{ 'answer-empty': isEmpty(getAnswer(child.key)) }">
                    {{ displayValue(getAnswer(child.key)) }}
                  </span>
                </div>
              </div>
            </template>

            <!-- DYNAMIC TABLE -->
            <template v-else-if="q.type === 'dynamic_table'">
              <div class="answer-row">
                <div class="answer-content">
                  <span class="answer-label">{{ q.label }}</span>
                  <div v-if="Array.isArray(getAnswer(q.key)) && getAnswer(q.key).length > 0" class="answer-table-wrap">
                    <table class="answer-table">
                      <thead>
                        <tr>
                          <th class="at-th" style="width:40px">STT</th>
                          <th v-for="col in (q.tableColumns || [])" :key="col.key" class="at-th">{{ col.label }}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="(row, ri) in getAnswer(q.key)" :key="ri">
                          <td class="at-td at-stt">{{ Number(ri) + 1 }}</td>
                          <td v-for="col in (q.tableColumns || [])" :key="col.key" class="at-td">{{ row[col.key] || '' }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <span v-else class="answer-value answer-empty">Chưa điền</span>
                </div>
              </div>
            </template>

            <!-- COMPUTED -->
            <template v-else-if="q.type === 'computed'">
              <div class="answer-row">
                <div class="answer-content">
                  <span class="answer-label">{{ q.label }} <span class="answer-computed-badge">Tự tính</span></span>
                  <span class="answer-value answer-computed">{{ isEmpty(getAnswer(q.key)) ? '—' : getAnswer(q.key) }}</span>
                </div>
              </div>
            </template>

            <!-- TABLE (static) -->
            <template v-else-if="q.type === 'table' && Array.isArray(getAnswer(q.key))">
              <div class="answer-row">
                <div class="answer-content">
                  <span class="answer-label">{{ q.label }}</span>
                  <div class="answer-table-wrap">
                    <table class="answer-table">
                      <thead>
                        <tr>
                          <th v-for="col in (q.columns || [])" :key="col" class="at-th">{{ col }}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="(row, ri) in getAnswer(q.key)" :key="ri">
                          <td v-for="col in (q.columns || [])" :key="col" class="at-td">{{ row[col] || '' }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </template>

            <!-- TEXTAREA (HTML) -->
            <template v-else-if="q.type === 'textarea' && getAnswer(q.key)">
              <div class="answer-row">
                <div class="answer-content">
                  <span class="answer-label">{{ q.label }}</span>
                  <div class="answer-html" v-html="getAnswer(q.key)"></div>
                </div>
              </div>
            </template>

            <!-- Normal text/number/date/radio/select/float -->
            <template v-else>
              <div class="answer-row">
                <div class="answer-content">
                  <span class="answer-label">{{ q.label }}</span>
                  <span class="answer-value" :class="{ 'answer-empty': isEmpty(getAnswer(q.key)) }">
                    {{ displayValue(getAnswer(q.key)) }}
                  </span>
                </div>
              </div>
            </template>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.material-icon {
  font-family: 'Material Icons';
  font-weight: normal;
  font-style: normal;
  font-size: 20px;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  display: inline-block;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  -webkit-font-smoothing: antialiased;
}

.btn-back {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  color: #6b7280;
  font-size: 0.875rem;
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.15s;
}

.btn-back:hover { color: #1a3a5c; }

/* Success banner */
.success-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  padding: 1rem 1.5rem;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 0.75rem;
}

.success-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #dcfce7;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.btn-history,
.btn-resubmit {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  color: #6b7280;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background: #fff;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-history:hover,
.btn-resubmit:hover {
  border-color: #9ca3af;
  background: #f9fafb;
}

.btn-print {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  color: #4b5563;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background: #f9fafb;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-print:hover {
  border-color: #9ca3af;
  background: #e5e7eb;
}

.btn-download {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #15803d;
  color: #fff;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-download:hover { background: #166534; }

.download-btn-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.btn-download-pdf {
  background: #1e3a5c;
}

.btn-download-pdf:hover {
  background: #152a45;
}

/* Tab bar */
.tab-bar {
  display: flex;
  gap: 0.25rem;
  background: #f3f4f6;
  border-radius: 0.5rem;
  padding: 0.25rem;
}

.tab-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.625rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #6b7280;
  background: transparent;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-btn:hover { color: #374151; }

.tab-active {
  background: #fff;
  color: #1a3a5c;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

/* Result card */
.result-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  position: relative;
}

.preview-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  z-index: 10;
  border-radius: 0.75rem;
}

/* Answers list */
.answers-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.answer-group-header {
  padding: 0.625rem 1rem;
  background: #f0f9ff;
  border: 1px solid #bfdbfe;
  border-radius: 0.5rem;
  margin-top: 0.25rem;
}

.answer-group-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1d4ed8;
}

.answer-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: 1px solid #f3f4f6;
  border-radius: 0.5rem;
  transition: background 0.1s;
}

.answer-row:hover { background: #fafafa; }

.answer-row-child {
  margin-left: 1rem;
  border-color: #e0f2fe;
}

.answer-content {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  flex: 1;
  min-width: 0;
}

.answer-label {
  font-size: 0.75rem;
  color: #9ca3af;
  font-weight: 500;
}

.answer-value {
  font-size: 0.9375rem;
  color: #1f2937;
  font-weight: 500;
  word-break: break-word;
}

.answer-empty {
  color: #d1d5db;
  font-style: italic;
}

.answer-computed {
  color: #92400e;
  font-weight: 600;
}

.answer-computed-badge {
  display: inline-block;
  margin-left: 0.25rem;
  padding: 0.0625rem 0.375rem;
  font-size: 0.5625rem;
  font-weight: 500;
  color: #d97706;
  background: #fef3c7;
  border-radius: 0.25rem;
  vertical-align: middle;
}

@media print {
  .result-page-nav,
  .btn-back,
  .success-banner,
  .print-browser-hint,
  .tab-bar,
  .answers-tab {
    display: none !important;
  }

  .result-card {
    box-shadow: none;
    border: none;
    padding: 0;
  }

  .preview-wrapper {
    margin: 0;
    border-radius: 0;
  }

  .pdf-preview-iframe {
    min-height: 100vh;
    border: none !important;
  }
}

/* Table answer */
.answer-table-wrap {
  margin-top: 0.25rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  overflow: hidden;
}

.answer-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.at-th {
  padding: 0.5rem 0.75rem;
  text-align: left;
  font-weight: 500;
  color: #6b7280;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.at-td {
  padding: 0.375rem 0.75rem;
  color: #374151;
  border-bottom: 1px solid #f3f4f6;
}

.at-stt {
  text-align: center;
  color: #9ca3af;
  font-weight: 500;
}

/* HTML answer (textarea rich-text) */
.answer-html {
  margin-top: 0.25rem;
  font-size: 0.9375rem;
  color: #1f2937;
  line-height: 1.6;
}

/* PDF preview (Word → PDF trên server) */
.pdf-preview-iframe {
  display: block;
  width: 100%;
  min-height: min(72vh, 820px);
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #525659;
}

/* XLSX table */
.xlsx-container {
  max-height: 70vh;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: auto;
}

.xlsx-table {
  width: 100%;
  font-size: 0.8125rem;
  border-collapse: collapse;
}

.xlsx-th {
  padding: 0.625rem 1rem;
  text-align: left;
  font-weight: 600;
  color: #374151;
  background: #f9fafb;
  border-bottom: 2px solid #e5e7eb;
  white-space: nowrap;
}

.xlsx-row {
  border-bottom: 1px solid #f3f4f6;
}

.xlsx-row:hover { background: #f9fafb; }

.xlsx-td {
  padding: 0.5rem 1rem;
  color: #4b5563;
  white-space: nowrap;
}
</style>
