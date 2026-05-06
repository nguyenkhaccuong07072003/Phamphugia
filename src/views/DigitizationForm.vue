<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api, { publicApi } from '../api'

interface TableColumn {
  key: string
  label: string
  type: 'text' | 'number' | 'radio' | 'select' | 'float' | 'textarea'
  options?: string[]
  valueMapping?: Record<string, string>
  textReplace?: string
}

interface Question {
  key: string
  label: string
  context?: string
  type: 'text' | 'number' | 'float' | 'date' | 'time' | 'select' | 'textarea' | 'radio' | 'table' | 'group' | 'dynamic_table' | 'computed' | 'yes_no'
  required: boolean
  placeholder?: string
  options?: string[]
  columns?: string[]
  // Group
  children?: Question[]
  // Dynamic table
  triggerKey?: string
  tableColumns?: TableColumn[]
  refKey?: string
  refColumns?: string[]
  // Computed
  formula?: string
  formulaDeps?: string[]
  // Yes/No condition
  conditionRef?: string
  conditionOp?: string
  conditionValue?: string
  trueText?: string
  falseText?: string
  // Default
  defaultValue?: any
  // Blank mapping
  blankIndex?: number | null
  blankIndices?: number[] | null
  fillRule?: string | null
  blankMapping?: Record<string, (number | null)[]> | null
  rowPattern?: {
    templateRows: number
    blanksPerRow: number
    startBlank: number
    columnOrder: string[]
  } | null
  // Text replacement for radio/select
  valueMapping?: Record<string, string>
  textReplace?: string
}

interface Template {
  id: number
  name: string
  slug: string
  description: string | null
  template_type: 'docx' | 'xlsx'
  template_file_url: string
  questions: Question[]
  category: string | null
  icon: string
  department_id: number | null
  department: { id: number; name: string; slug: string } | null
}

const route = useRoute()
const router = useRouter()

const template = ref<Template | null>(null)
const answers = ref<Record<string, any>>({})
const loading = ref(false)
const submitting = ref(false)
const formErrors = ref<Record<string, string>>({})
const activeTab = ref<'create' | 'history'>('create')

// History state
interface Submission {
  id: number
  template_id: number
  status: string
  display_filename?: string
  display_filename_pdf?: string
  created_at?: string | null
  createdAt?: string | null
  template: { id: number; name: string; slug: string; template_type: 'docx' | 'xlsx'; icon: string }
}
const submissions = ref<Submission[]>([])
const historyLoading = ref(false)
const historyPage = ref(1)
const historyTotalPages = ref(1)

const deleteModalOpen = ref(false)
const submissionToDelete = ref<Submission | null>(null)
const deleteSubmitting = ref(false)

function openDeleteModal(sub: Submission) {
  submissionToDelete.value = sub
  deleteModalOpen.value = true
}

function closeDeleteModal() {
  deleteModalOpen.value = false
  submissionToDelete.value = null
}

function goBack() {
  if (template.value?.department?.slug) {
    const query: Record<string, any> = {}
    if (route.query.company != null) query.company = route.query.company
    if (route.query.company_id != null) query.company_id = route.query.company_id
    if (route.query.company_slug != null) query.company_slug = route.query.company_slug
    router.push({
      name: 'department-detail',
      params: { slug: template.value.department.slug },
      // Giữ lại query lọc công ty để trang department refetch đúng filter
      query,
    })
  } else {
    router.back()
  }
}

function getTodayDate(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function adjustDate(key: string, days: number) {
  const current = answers.value[key] || getTodayDate()
  const d = new Date(current)
  d.setDate(d.getDate() + days)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  answers.value[key] = `${yyyy}-${mm}-${dd}`
}

function getNowTime(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatTimeInput(event: Event, key: string) {
  const input = event.target as HTMLInputElement
  let val = input.value.replace(/\D/g, '')

  if (val.length >= 3) {
    val = val.slice(0, 2) + ':' + val.slice(2, 4)
  }

  answers.value[key] = val.slice(0, 5)
}

function initAnswers(questions: Question[]) {
  const today = getTodayDate()
  for (const q of questions) {
    if (q.type === 'table') {
      answers.value[q.key] = [createEmptyRow(q)]
    } else if (q.type === 'group') {
      for (const child of (q.children || [])) {
        if (child.type === 'table') {
          answers.value[child.key] = [createEmptyRow(child)]
        } else if (child.type === 'dynamic_table') {
          answers.value[child.key] = []
        } else if (child.type === 'date') {
          // Date: luôn chỉ chọn NGÀY (yyyy-mm-dd), không lẫn với giờ/phút
          answers.value[child.key] = child.defaultValue ?? today
        } else if (child.type === 'time') {
          answers.value[child.key] = child.defaultValue ?? getNowTime()
        } else if (child.type === 'computed' || child.type === 'yes_no') {
          answers.value[child.key] = ''
        } else {
          answers.value[child.key] = child.defaultValue ?? ''
        }
      }
    } else if (q.type === 'dynamic_table') {
      answers.value[q.key] = []
    } else if (q.type === 'computed' || q.type === 'yes_no') {
      answers.value[q.key] = ''
    } else if (q.type === 'date') {
      // Date: luôn chỉ chọn NGÀY (yyyy-mm-dd), không lẫn với giờ/phút
      answers.value[q.key] = q.defaultValue ?? today
    } else if (q.type === 'time') {
      answers.value[q.key] = q.defaultValue ?? getNowTime()
    } else {
      answers.value[q.key] = q.defaultValue ?? ''
    }
  }
}

async function fetchTemplate() {
  loading.value = true
  try {
    const params: Record<string, any> = {}
    // Ưu tiên query rõ ràng backend hỗ trợ
    const rawCompanyId = route.query.company_id
    const rawCompanySlug = route.query.company_slug
    const rawCompany = route.query.company

    if (rawCompanyId != null) {
      const raw = String(rawCompanyId)
      if (raw === 'null') params.company_id = 'null'
      else params.company_id = raw
    } else if (rawCompanySlug != null) {
      params.company_slug = String(rawCompanySlug)
    } else if (rawCompany != null) {
      const raw = String(rawCompany)
      if (raw === 'null') params.company_slug = 'null'
      else if (/^\d+$/.test(raw)) params.company_id = raw
      else params.company_slug = raw
    }
    const { data } = await publicApi.get(`/public/digitization/templates/${route.params.slug}`, { params })
    template.value = data.data
    if (template.value) {
      initAnswers(template.value.questions)
    }
  } catch (e) {
    console.error('Failed to fetch template:', e)
  } finally {
    loading.value = false
  }
}

function createEmptyRow(q: Question): Record<string, string> {
  const row: Record<string, string> = {}
  for (const col of (q.columns || [])) {
    row[col] = ''
  }
  return row
}

function createEmptyDynRow(q: Question): Record<string, string> {
  const row: Record<string, string> = {}
  for (const col of (q.tableColumns || [])) {
    // Default to first option cho radio/select nếu tồn tại, ngược lại để chuỗi rỗng
    const firstOpt =
      (col.type === 'radio' || col.type === 'select') && col.options?.length
        ? col.options![0] ?? ''
        : ''
    row[col.key] = firstOpt
  }
  return row
}

function addTableRow(qKey: string, q: Question) {
  const rows = answers.value[qKey] as Record<string, string>[]
  rows.push(createEmptyRow(q))
}

function removeTableRow(qKey: string, rowIndex: number) {
  const rows = answers.value[qKey] as Record<string, string>[]
  if (rows.length <= 1) return
  rows.splice(rowIndex, 1)
}

// Dynamic table: watch trigger key changes to adjust row count
function getDynTableRowCount(q: Question): number {
  if (!q.triggerKey) return 0
  const val = parseInt(answers.value[q.triggerKey])
  return isNaN(val) ? 0 : Math.max(0, Math.min(val, 100))
}

function syncDynTableRows(q: Question) {
  const count = getDynTableRowCount(q)
  const current = answers.value[q.key] as Record<string, string>[]
  if (!Array.isArray(current)) {
    answers.value[q.key] = []
  }
  const rows = answers.value[q.key] as Record<string, string>[]

  // Fill reference data if refKey is set
  const refData = q.refKey ? (answers.value[q.refKey] as Record<string, string>[] || []) : []

  while (rows.length < count) {
    const newRow = createEmptyDynRow(q)
    // Copy ref data if available
    const refRow = refData[rows.length]
    if (refRow) {
      for (const col of (q.tableColumns || [])) {
        if (refRow[col.key] !== undefined) {
          newRow[col.key] = refRow[col.key] ?? ''
        }
      }
    }
    rows.push(newRow)
  }
  while (rows.length > count) {
    rows.pop()
  }
}

// Computed fields: evaluate formula
function evaluateComputed(q: Question): string {
  if (!q.formula) return ''
  let result = q.formula
  // Replace {key} with actual values
  const matches = q.formula.match(/\{([^}]+)\}/g)
  if (matches) {
    for (const m of matches) {
      const key = m.slice(1, -1)
      const val = parseFloat(answers.value[key])
      result = result.replace(m, isNaN(val) ? '0' : String(val))
    }
  }
  try {
    // Safe eval: only allow numbers and basic math operators
    if (/^[\d\s+\-*/().]+$/.test(result)) {
      const computed = Function('"use strict"; return (' + result + ')')()
      return typeof computed === 'number' ? String(Math.round(computed * 100) / 100) : String(computed)
    }
    return result
  } catch {
    return ''
  }
}

function evaluateYesNo(q: Question): string {
  if (!q.conditionRef || !q.conditionOp || q.conditionValue === undefined) return ''
  const refVal = parseFloat(answers.value[q.conditionRef])
  const threshold = parseFloat(q.conditionValue)
  if (isNaN(refVal) || isNaN(threshold)) return ''
  let result = false
  switch (q.conditionOp) {
    case '>=': result = refVal >= threshold; break
    case '<=': result = refVal <= threshold; break
    case '>': result = refVal > threshold; break
    case '<': result = refVal < threshold; break
    case '==': result = refVal === threshold; break
    case '!=': result = refVal !== threshold; break
  }
  return result ? (q.trueText || 'Có') : (q.falseText || 'Không')
}

// Sequential filling: check if a question has been answered
function isQuestionFilled(q: Question): boolean {
  if (q.type === 'group') {
    return (q.children || []).every(child => {
      if (child.type === 'computed' || child.type === 'yes_no') return true
      const val = answers.value[child.key]
      if (child.type === 'table') {
        const rows = val as Record<string, string>[]
        return Array.isArray(rows) && rows.some(row => Object.values(row).some(v => v && v.trim() !== ''))
      }
      if (child.type === 'dynamic_table') {
        const rows = val as any[]
        return Array.isArray(rows) && rows.length > 0
      }
      return val !== undefined && val !== null && val !== ''
    })
  }
  if (q.type === 'dynamic_table') {
    const rows = answers.value[q.key] as any[]
    return Array.isArray(rows) && rows.length > 0
  }
  if (q.type === 'computed' || q.type === 'yes_no') {
    return true // auto-filled
  }
  const val = answers.value[q.key]
  if (q.type === 'table') {
    const rows = val as Record<string, string>[]
    return Array.isArray(rows) && rows.some(row => Object.values(row).some(v => v && v.trim() !== ''))
  }
  return val !== undefined && val !== null && val !== ''
}

// Get the index of the first unfilled question (all before it are unlocked)
function getUnlockedUpTo(): number {
  if (!template.value) return 0
  for (let i = 0; i < template.value.questions.length; i++) {
    if (!isQuestionFilled(template.value.questions[i]!)) {
      return i
    }
  }
  return template.value.questions.length - 1
}

function isQuestionLocked(qIndex: number): boolean {
  const unlockedUpTo = getUnlockedUpTo()
  return qIndex > unlockedUpTo
}

function validateForm(): boolean {
  formErrors.value = {}
  if (!template.value) return false
  // No required validation — all fields are optional, empty fields keep original dots
  return true
}

async function submitForm() {
  if (!template.value || !validateForm()) return
  submitting.value = true

  // Update computed values before submit
  for (const q of template.value.questions) {
    if (q.type === 'computed') {
      answers.value[q.key] = evaluateComputed(q)
    }
  }

  try {
    const { data } = await api.post(`/admin/digitization/submit/${template.value.id}`, {
      answers: answers.value,
    })
    const submissionId = data.data.id
    router.push({ name: 'digitization-result', params: { submissionId } })
  } catch (e: any) {
    console.error('Failed to submit:', e)
    alert(e.response?.data?.message || 'Lỗi khi nộp biểu mẫu')
  } finally {
    submitting.value = false
  }
}

async function fetchHistory() {
  if (!template.value) return
  historyLoading.value = true
  try {
    const { data } = await api.get('/admin/digitization/submissions', {
      params: { template_id: template.value.id, page: historyPage.value, limit: 10 },
    })
    submissions.value = data.data || []
    historyTotalPages.value = data.pagination?.totalPages || 1
  } catch (e) {
    console.error('Failed to fetch history:', e)
  } finally {
    historyLoading.value = false
  }
}

function historyGoToPage(p: number) {
  if (p < 1 || p > historyTotalPages.value) return
  historyPage.value = p
  fetchHistory()
}

function viewResult(id: number) {
  router.push({ name: 'digitization-result', params: { submissionId: id } })
}

async function downloadFile(sub: Submission) {
  try {
    const response = await api.get(
      `/admin/digitization/submissions/${sub.id}/download`,
      { responseType: 'blob' }
    )
    const ext = sub.template.template_type
    const filename = sub.display_filename ?? `${sub.template.name}_${sub.id}.${ext}`
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  } catch (e) {
    console.error('Download failed:', e)
    alert('Lỗi khi tải file')
  }
}

async function confirmDelete() {
  const sub = submissionToDelete.value
  if (!sub) return
  deleteSubmitting.value = true
  try {
    await api.delete(`/admin/digitization/submissions/${sub.id}`)
    submissions.value = submissions.value.filter(s => s.id !== sub.id)
    closeDeleteModal()
  } catch (e) {
    console.error('Delete failed:', e)
    alert('Lỗi khi xóa văn bản')
  } finally {
    deleteSubmitting.value = false
  }
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return 'Chưa rõ'

  let normalized = dateStr.trim()

  // Backend có thể trả "YYYY-MM-DD HH:mm:ss" (không có "T"/timezone)
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

function switchTab(tab: 'create' | 'history') {
  activeTab.value = tab
  if (tab === 'history') fetchHistory()
}

// Watch for trigger key changes to sync dynamic table rows
watch(answers, () => {
  if (!template.value) return
  for (const q of template.value.questions) {
    if (q.type === 'dynamic_table' && q.triggerKey) {
      syncDynTableRows(q)
    }
    if (q.type === 'computed') {
      answers.value[q.key] = evaluateComputed(q)
    }
    if (q.type === 'yes_no') {
      answers.value[q.key] = evaluateYesNo(q)
    }
    // Sync child dynamic_table/computed/yes_no within groups
    if (q.type === 'group') {
      for (const child of (q.children || [])) {
        if (child.type === 'dynamic_table' && child.triggerKey) {
          syncDynTableRows(child)
        }
        if (child.type === 'computed') {
          answers.value[child.key] = evaluateComputed(child)
        }
        if (child.type === 'yes_no') {
          answers.value[child.key] = evaluateYesNo(child)
        }
      }
    }
  }
}, { deep: true })

onMounted(fetchTemplate)
</script>

<template>
  <div class="w-full py-6 px-6 max-sm:px-3 max-sm:py-4">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="text-gray-400">Đang tải...</div>
    </div>

    <!-- Not found -->
    <div v-else-if="!template" class="text-center py-20">
      <span class="material-icon text-5xl text-gray-300">error_outline</span>
      <p class="text-gray-400 mt-3">Không tìm thấy mẫu biểu</p>
      <button class="btn-back mt-4" @click="goBack()">
        <span class="material-icon text-base">arrow_back</span> Quay lại
      </button>
    </div>

    <!-- Main content -->
    <div v-else class="form-page">
      <!-- Top bar -->
      <div class="top-bar">
        <div class="flex items-center gap-3">
          <button class="btn-back" @click="goBack()">
            <span class="material-icon text-base">arrow_back</span>
          </button>
          <div class="template-icon-sm">
            <span class="material-icon">{{ template.icon || 'description' }}</span>
          </div>
          <div>
            <h1 class="text-base font-bold" style="color: #1a3a5c">{{ template.name }}</h1>
            <p v-if="template.description" class="text-xs text-gray-500">{{ template.description }}</p>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs-bar">
        <button class="tab-btn" :class="{ active: activeTab === 'create' }" @click="switchTab('create')">
          <span class="material-icon text-base">edit_note</span>
          Tạo mới
        </button>
        <button class="tab-btn" :class="{ active: activeTab === 'history' }" @click="switchTab('history')">
          <span class="material-icon text-base">history</span>
          Lịch sử
        </button>
      </div>

      <!-- TAB: Tạo mới -->
      <div v-show="activeTab === 'create'">
        <div class="form-card">
          <table class="form-table">
            <thead>
              <tr>
                <th class="ft-th ft-th-label">Câu hỏi</th>
                <th class="ft-th ft-th-answer">Trả lời</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="(q, i) in template.questions" :key="q.key">
                <!-- GROUP type: renders as section header + sub-rows -->
                <template v-if="q.type === 'group'">
                  <tr class="ft-row ft-row-group" :class="{ 'ft-locked': isQuestionLocked(i) }">
                    <td colspan="2" class="ft-td ft-group-header">
                      <span class="ft-group-label">{{ q.label }}</span>
                      <span v-if="isQuestionLocked(i)" class="ft-lock-icon material-icon">lock</span>
                    </td>
                  </tr>
                  <tr v-for="child in (q.children || [])" :key="child.key" class="ft-row ft-row-child"
                    :class="{ 'ft-locked': isQuestionLocked(i) }">
                    <td class="ft-td ft-td-label ft-td-child">
                      <span class="ft-label">{{ child.label }}</span>
                      <span v-if="child.required" class="text-red-500 ml-0.5">*</span>
                    </td>
                    <td class="ft-td ft-td-answer">
                      <!-- Child: text -->
                      <input v-if="child.type === 'text'" v-model="answers[child.key]" type="text" class="ft-input"
                        :class="{ 'ft-input-error': formErrors[child.key] }"
                        :placeholder="child.placeholder || 'Nhập...'" :disabled="isQuestionLocked(i)" />
                      <!-- Child: number -->
                      <input v-else-if="child.type === 'number'" v-model="answers[child.key]" type="number"
                        class="ft-input" :class="{ 'ft-input-error': formErrors[child.key] }"
                        :placeholder="child.placeholder || 'Nhập số...'" :disabled="isQuestionLocked(i)" />
                      <!-- Child: float -->
                      <input v-else-if="child.type === 'float'" v-model="answers[child.key]" type="number" step="0.01"
                        class="ft-input" :class="{ 'ft-input-error': formErrors[child.key] }"
                        :placeholder="child.placeholder || 'Nhập số thực...'" :disabled="isQuestionLocked(i)" />
                      <!-- Child: date / datetime -->
                      <div v-else-if="child.type === 'date'" class="ft-date-wrap">
                        <button type="button" class="ft-date-arrow" :disabled="isQuestionLocked(i)"
                          @click="adjustDate(child.key, -1)" title="Ngày trước">
                          <span class="material-icon text-sm">keyboard_arrow_down</span>
                        </button>
                        <input v-model="answers[child.key]" type="date"
                          class="ft-input ft-date-input" :class="{ 'ft-input-error': formErrors[child.key] }"
                          :disabled="isQuestionLocked(i)" />
                        <button type="button" class="ft-date-arrow" :disabled="isQuestionLocked(i)"
                          @click="adjustDate(child.key, 1)" title="Ngày sau">
                          <span class="material-icon text-sm">keyboard_arrow_up</span>
                        </button>
                      </div>
                      <!-- Child: radio -->
                      <div v-else-if="child.type === 'radio'" class="ft-radio-group ft-radio-inline">
                        <label v-for="opt in child.options" :key="opt" class="ft-radio-label"
                          :class="{ 'ft-radio-selected': answers[child.key] === opt, 'ft-radio-disabled': isQuestionLocked(i) }">
                          <input type="radio" :name="'child_' + child.key" :value="opt" v-model="answers[child.key]"
                            class="ft-radio-input" :disabled="isQuestionLocked(i)" />
                          {{ opt }}
                        </label>
                      </div>
                      <!-- Child: select -->
                      <select v-else-if="child.type === 'select'" v-model="answers[child.key]" class="ft-input"
                        :class="{ 'ft-input-error': formErrors[child.key] }" :disabled="isQuestionLocked(i)">
                        <option value="">-- Chọn --</option>
                        <option v-for="opt in child.options" :key="opt" :value="opt">{{ opt }}</option>
                      </select>
                      <!-- Child: time (24h format) -->
                      <input v-else-if="child.type === 'time'" :value="answers[child.key]"
                        @input="formatTimeInput($event, child.key)" type="text" placeholder="HH:mm (VD: 14:05)"
                        maxlength="5" class="ft-input" :class="{ 'ft-input-error': formErrors[child.key] }"
                        :disabled="isQuestionLocked(i)" />
                      <!-- Child: textarea (plain, multiline) -->
                      <textarea v-else-if="child.type === 'textarea'" v-model="answers[child.key]"
                        class="ft-input ft-textarea" :class="{ 'ft-input-error': formErrors[child.key] }"
                        :placeholder="child.placeholder || 'Nhập nội dung...'" :disabled="isQuestionLocked(i)"
                        rows="5"></textarea>
                      <!-- Child: yes_no auto -->
                      <div v-else-if="child.type === 'yes_no'" class="ft-computed-value">
                        {{ answers[child.key] || '—' }}
                      </div>
                      <!-- Child: computed -->
                      <div v-else-if="child.type === 'computed'" class="ft-computed-value">
                        {{ answers[child.key] || '—' }}
                      </div>
                      <!-- Child: table -->
                      <div v-else-if="child.type === 'table'" class="ft-table-wrap">
                        <table class="ft-inner-table">
                          <thead>
                            <tr>
                              <th v-for="col in child.columns" :key="col" class="ft-inner-th">{{ col }}</th>
                              <th class="ft-inner-th" style="width: 36px"></th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr v-for="(row, ri) in (answers[child.key] as Record<string, string>[])" :key="ri">
                              <td v-for="col in child.columns" :key="col" class="ft-inner-td">
                                <input v-model="row[col]" type="text" class="ft-inner-input" placeholder="..."
                                  :disabled="isQuestionLocked(i)" />
                              </td>
                              <td class="ft-inner-td">
                                <button
                                  v-if="(answers[child.key] as Record<string, string>[]).length > 1 && !isQuestionLocked(i)"
                                  type="button" class="ft-row-remove" @click="removeTableRow(child.key, ri)"
                                  title="Xóa dòng">
                                  <span class="material-icon text-sm">close</span>
                                </button>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <button v-if="!isQuestionLocked(i)" type="button" class="ft-add-row-btn"
                          @click="addTableRow(child.key, child)">
                          <span class="material-icon text-sm">add</span> Thêm dòng
                        </button>
                      </div>
                      <!-- Child: dynamic_table -->
                      <div v-else-if="child.type === 'dynamic_table'" class="ft-dynatable-section">
                        <div class="ft-dynatable-header">
                          <span class="ft-dynatable-count">{{ (answers[child.key] as any[])?.length || 0 }} dòng</span>
                        </div>
                        <div v-if="(answers[child.key] as any[])?.length > 0" class="ft-table-wrap">
                          <table class="ft-inner-table">
                            <thead>
                              <tr>
                                <th class="ft-inner-th" style="width:36px">STT</th>
                                <th v-for="col in child.tableColumns" :key="col.key" class="ft-inner-th">{{ col.label }}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr v-for="(row, ri) in (answers[child.key] as Record<string, string>[])" :key="ri">
                                <td class="ft-inner-td ft-stt">{{ ri + 1 }}</td>
                                <td v-for="col in child.tableColumns" :key="col.key" class="ft-inner-td">
                                  <input
                                    v-if="col.type === 'text' || col.type === 'number' || col.type === 'float'"
                                    v-model="row[col.key]"
                                    :type="col.type === 'text' ? 'text' : 'number'"
                                    :step="col.type === 'float' ? '0.01' : undefined"
                                    class="ft-inner-input"
                                    placeholder="..."
                                    :disabled="isQuestionLocked(i)"
                                  />
                                  <div v-else-if="col.type === 'radio'" class="ft-cell-radio">
                                    <label v-for="opt in col.options" :key="opt" class="ft-cell-radio-label"
                                      :class="{ 'ft-cell-radio-selected': row[col.key] === opt }">
                                      <input type="radio" :name="'cdyn_' + child.key + '_' + ri + '_' + col.key"
                                        :value="opt" v-model="row[col.key]" :disabled="isQuestionLocked(i)" />
                                      {{ opt }}
                                    </label>
                                  </div>
                                  <select v-else-if="col.type === 'select'" v-model="row[col.key]"
                                    class="ft-inner-input" :disabled="isQuestionLocked(i)">
                                    <option value="">--</option>
                                    <option v-for="opt in col.options" :key="opt" :value="opt">{{ opt }}</option>
                                  </select>
                                  <textarea v-else-if="col.type === 'textarea'" v-model="row[col.key]"
                                    class="ft-inner-input ft-cell-textarea" placeholder="Nhập nội dung..."
                                    :disabled="isQuestionLocked(i)" rows="3"></textarea>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <div v-else class="ft-dynatable-empty">
                          Nhập số lượng ở câu hỏi liên quan để tạo bảng
                        </div>
                      </div>
                      <p v-if="formErrors[child.key]" class="ft-error">{{ formErrors[child.key] }}</p>
                    </td>
                  </tr>
                </template>

                <!-- DYNAMIC TABLE type -->
                <template v-else-if="q.type === 'dynamic_table'">
                  <tr class="ft-row" :class="{ 'ft-locked': isQuestionLocked(i) }">
                    <td colspan="2" class="ft-td">
                      <div class="ft-dynatable-section">
                        <div class="ft-dynatable-header">
                          <span class="ft-label">{{ q.label }}</span>
                          <span v-if="isQuestionLocked(i)" class="ft-lock-icon material-icon">lock</span>
                          <span class="ft-dynatable-count">{{ (answers[q.key] as any[])?.length || 0 }} dòng</span>
                        </div>
                        <div v-if="(answers[q.key] as any[])?.length > 0" class="ft-table-wrap">
                          <table class="ft-inner-table">
                            <thead>
                              <tr>
                                <th class="ft-inner-th" style="width:36px">STT</th>
                                <th v-for="col in q.tableColumns" :key="col.key" class="ft-inner-th">{{ col.label }}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr v-for="(row, ri) in (answers[q.key] as Record<string, string>[])" :key="ri">
                                <td class="ft-inner-td ft-stt">{{ ri + 1 }}</td>
                                <td v-for="col in q.tableColumns" :key="col.key" class="ft-inner-td">
                                  <!-- Text/Number/Float column -->
                                  <input
                                    v-if="col.type === 'text' || col.type === 'number' || col.type === 'float'"
                                    v-model="row[col.key]"
                                    :type="col.type === 'text' ? 'text' : 'number'"
                                    :step="col.type === 'float' ? '0.01' : undefined"
                                    class="ft-inner-input"
                                    placeholder="..."
                                    :disabled="isQuestionLocked(i)"
                                  />
                                  <!-- Radio column -->
                                  <div v-else-if="col.type === 'radio'" class="ft-cell-radio">
                                    <label v-for="opt in col.options" :key="opt" class="ft-cell-radio-label"
                                      :class="{ 'ft-cell-radio-selected': row[col.key] === opt }">
                                      <input type="radio" :name="'dyn_' + q.key + '_' + ri + '_' + col.key" :value="opt"
                                        v-model="row[col.key]" :disabled="isQuestionLocked(i)" />
                                      {{ opt }}
                                    </label>
                                  </div>
                                  <!-- Select column -->
                                  <select v-else-if="col.type === 'select'" v-model="row[col.key]"
                                    class="ft-inner-input" :disabled="isQuestionLocked(i)">
                                    <option value="">--</option>
                                    <option v-for="opt in col.options" :key="opt" :value="opt">{{ opt }}</option>
                                  </select>
                                  <!-- Textarea column -->
                                  <textarea v-else-if="col.type === 'textarea'" v-model="row[col.key]"
                                    class="ft-inner-input ft-cell-textarea" placeholder="Nhập nội dung..."
                                    :disabled="isQuestionLocked(i)" rows="3"></textarea>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <div v-else class="ft-dynatable-empty">
                          Nhập số lượng ở câu hỏi liên quan để tạo bảng
                        </div>
                      </div>
                    </td>
                  </tr>
                </template>

                <!-- COMPUTED type -->
                <template v-else-if="q.type === 'computed'">
                  <tr class="ft-row">
                    <td class="ft-td ft-td-label">
                      <span class="ft-label">{{ q.label }}</span>
                      <span class="ft-computed-badge">Tự tính</span>
                    </td>
                    <td class="ft-td ft-td-answer">
                      <div class="ft-computed-value">{{ answers[q.key] || '—' }}</div>
                    </td>
                  </tr>
                </template>

                <!-- Regular question types -->
                <template v-else>
                  <tr class="ft-row" :class="{ 'ft-locked': isQuestionLocked(i) }">
                    <td class="ft-td ft-td-label">
                      <span class="ft-label">{{ q.label }}</span>
                      <span v-if="q.required" class="text-red-500 ml-0.5">*</span>
                      <span v-if="isQuestionLocked(i)" class="ft-lock-icon material-icon">lock</span>
                    </td>
                    <td class="ft-td ft-td-answer">
                      <!-- Text -->
                      <input v-if="q.type === 'text'" v-model="answers[q.key]" type="text" class="ft-input"
                        :class="{ 'ft-input-error': formErrors[q.key] }" :placeholder="q.placeholder || 'Nhập...'"
                        :disabled="isQuestionLocked(i)" />

                      <!-- Number -->
                      <input v-else-if="q.type === 'number'" v-model="answers[q.key]" type="number" class="ft-input"
                        :class="{ 'ft-input-error': formErrors[q.key] }" :placeholder="q.placeholder || 'Nhập số...'"
                        :disabled="isQuestionLocked(i)" />

                      <!-- Float -->
                      <input v-else-if="q.type === 'float'" v-model="answers[q.key]" type="number" step="0.01"
                        class="ft-input" :class="{ 'ft-input-error': formErrors[q.key] }"
                        :placeholder="q.placeholder || 'Nhập số thực...'" :disabled="isQuestionLocked(i)" />

                      <!-- Date / Datetime -->
                      <div v-else-if="q.type === 'date'" class="ft-date-wrap">
                        <button type="button" class="ft-date-arrow" :disabled="isQuestionLocked(i)"
                          @click="adjustDate(q.key, -1)" title="Ngày trước">
                          <span class="material-icon text-sm">keyboard_arrow_down</span>
                        </button>
                        <input v-model="answers[q.key]" type="date"
                          class="ft-input ft-date-input" :class="{ 'ft-input-error': formErrors[q.key] }"
                          :disabled="isQuestionLocked(i)" />
                        <button type="button" class="ft-date-arrow" :disabled="isQuestionLocked(i)"
                          @click="adjustDate(q.key, 1)" title="Ngày sau">
                          <span class="material-icon text-sm">keyboard_arrow_up</span>
                        </button>
                      </div>

                      <!-- Select -->
                      <select v-else-if="q.type === 'select'" v-model="answers[q.key]" class="ft-input"
                        :class="{ 'ft-input-error': formErrors[q.key] }" :disabled="isQuestionLocked(i)">
                        <option value="" disabled>-- Chọn --</option>
                        <option v-for="opt in q.options" :key="opt" :value="opt">{{ opt }}</option>
                      </select>

                      <!-- Radio -->
                      <div v-else-if="q.type === 'radio'" class="ft-radio-group">
                        <label v-for="opt in q.options" :key="opt" class="ft-radio-label"
                          :class="{ 'ft-radio-selected': answers[q.key] === opt, 'ft-radio-disabled': isQuestionLocked(i) }">
                          <input type="radio" :name="'q_' + q.key" :value="opt" v-model="answers[q.key]"
                            class="ft-radio-input" :disabled="isQuestionLocked(i)" />
                          {{ opt }}
                        </label>
                        <p v-if="formErrors[q.key]" class="ft-error">{{ formErrors[q.key] }}</p>
                      </div>

                      <!-- Time (24h format) -->
                      <input v-else-if="q.type === 'time'" :value="answers[q.key]"
                        @input="formatTimeInput($event, q.key)" type="text" placeholder="HH:mm (VD: 14:05)"
                        maxlength="5" class="ft-input" :class="{ 'ft-input-error': formErrors[q.key] }"
                        :disabled="isQuestionLocked(i)" />

                      <!-- Textarea (plain, multiline) -->
                      <textarea v-else-if="q.type === 'textarea'" v-model="answers[q.key]" class="ft-input ft-textarea"
                        :class="{ 'ft-input-error': formErrors[q.key] }"
                        :placeholder="q.placeholder || 'Nhập nội dung...'" :disabled="isQuestionLocked(i)"
                        rows="5"></textarea>

                      <!-- Yes/No auto -->
                      <div v-else-if="q.type === 'yes_no'" class="ft-computed-value">
                        {{ answers[q.key] || '—' }}
                      </div>

                      <!-- Table -->
                      <div v-else-if="q.type === 'table'" class="ft-table-wrap">
                        <table class="ft-inner-table">
                          <thead>
                            <tr>
                              <th v-for="col in q.columns" :key="col" class="ft-inner-th">{{ col }}</th>
                              <th class="ft-inner-th" style="width: 36px"></th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr v-for="(row, ri) in (answers[q.key] as Record<string, string>[])" :key="ri">
                              <td v-for="col in q.columns" :key="col" class="ft-inner-td">
                                <input v-model="row[col]" type="text" class="ft-inner-input" placeholder="..."
                                  :disabled="isQuestionLocked(i)" />
                              </td>
                              <td class="ft-inner-td">
                                <button
                                  v-if="(answers[q.key] as Record<string, string>[]).length > 1 && !isQuestionLocked(i)"
                                  type="button" class="ft-row-remove" @click="removeTableRow(q.key, ri)"
                                  title="Xóa dòng">
                                  <span class="material-icon text-sm">close</span>
                                </button>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <button v-if="!isQuestionLocked(i)" type="button" class="ft-add-row-btn"
                          @click="addTableRow(q.key, q)">
                          <span class="material-icon text-sm">add</span> Thêm dòng
                        </button>
                      </div>

                      <!-- Error message (for non-radio types) -->
                      <p v-if="formErrors[q.key] && q.type !== 'radio'" class="ft-error">{{ formErrors[q.key] }}</p>
                    </td>
                  </tr>
                </template>
              </template>
            </tbody>
          </table>

          <!-- Submit -->
          <div class="form-submit-bar">
            <button class="btn-submit" @click="submitForm" :disabled="submitting">
              <span v-if="submitting" class="material-icon text-sm animate-spin">progress_activity</span>
              <span v-else class="material-icon text-sm">send</span>
              {{ submitting ? 'Đang xử lý...' : 'Nộp biểu mẫu' }}
            </button>
          </div>
        </div>
      </div>

      <!-- TAB: Lịch sử -->
      <div v-show="activeTab === 'history'" class="history-section">
        <div v-if="historyLoading" class="flex items-center justify-center py-12">
          <div class="text-gray-400 text-sm">Đang tải lịch sử...</div>
        </div>

        <div v-else-if="submissions.length === 0" class="text-center py-12">
          <span class="material-icon text-4xl text-gray-300">inbox</span>
          <p class="text-gray-400 text-sm mt-2">Chưa có văn bản nào được tạo</p>
        </div>

        <div v-else>
          <div class="history-list">
            <div v-for="sub in submissions" :key="sub.id" class="history-item">
              <div class="history-item-info">
                <div class="history-item-title">
                  <span class="material-icon text-base" style="color: #1a3a5c">{{ sub.template?.icon || 'description'
                  }}</span>
                  <span>{{ sub.template?.name || 'Văn bản' }} #{{ sub.id }}</span>
                </div>
                <div class="history-item-meta">
                  <span class="history-status" :class="sub.status">{{ sub.status === 'completed' ? 'Hoàn thành' :
                    sub.status
                  }}</span>
                  <span class="text-gray-400">{{ formatDate(sub.created_at ?? (sub as any).createdAt) }}</span>
                </div>
              </div>
              <div class="history-item-actions">
                <button class="btn-action btn-view" @click="viewResult(sub.id)" title="Xem kết quả">
                  <span class="material-icon text-sm">visibility</span>
                </button>
                <button class="btn-action btn-download-action" @click="downloadFile(sub)" title="Tải xuống">
                  <span class="material-icon text-sm">download</span>
                </button>
                <button class="btn-action btn-del" @click="openDeleteModal(sub)" title="Xóa">
                  <span class="material-icon text-sm">delete</span>
                </button>
              </div>
            </div>
          </div>

          <div v-if="historyTotalPages > 1" class="history-pagination">
            <button class="page-btn" :disabled="historyPage <= 1" @click="historyGoToPage(historyPage - 1)">
              <span class="material-icon text-sm">chevron_left</span>
            </button>
            <span class="page-info">{{ historyPage }} / {{ historyTotalPages }}</span>
            <button class="page-btn" :disabled="historyPage >= historyTotalPages"
              @click="historyGoToPage(historyPage + 1)">
              <span class="material-icon text-sm">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="deleteModalOpen && submissionToDelete"
        class="delete-modal-root"
        role="dialog"
        aria-modal="true"
        aria-labelledby="digit-form-delete-modal-title"
      >
        <div class="delete-modal-backdrop" @click="!deleteSubmitting && closeDeleteModal()" />
        <div class="delete-modal-panel">
          <div class="delete-modal-icon-wrap" aria-hidden="true">
            <span class="material-icon delete-modal-icon">warning</span>
          </div>
          <h2 id="digit-form-delete-modal-title" class="delete-modal-title">Xóa văn bản?</h2>
          <p class="delete-modal-text">
            Bạn có chắc muốn xóa
            <strong class="delete-modal-strong">“{{ submissionToDelete.template?.name || 'văn bản này' }}”</strong>?
            Thao tác này không thể hoàn tác.
          </p>
          <div class="delete-modal-actions">
            <button type="button" class="delete-modal-btn cancel" @click="closeDeleteModal">
              Hủy
            </button>
            <button
              type="button"
              class="delete-modal-btn danger"
              :disabled="deleteSubmitting"
              @click="confirmDelete"
            >
              {{ deleteSubmitting ? 'Đang xóa...' : 'Xóa' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
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

.form-page {
  max-width: 960px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Top bar */
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.template-icon-sm {
  width: 36px;
  height: 36px;
  border-radius: 0.5rem;
  background: #f0f9ff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.template-icon-sm .material-icon {
  font-size: 20px;
  color: #1a3a5c;
}

.btn-back {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: #6b7280;
  font-size: 0.875rem;
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.15s;
}

.btn-back:hover {
  color: #1a3a5c;
}

/* Tabs */
.tabs-bar {
  display: flex;
  gap: 0.5rem;
  border-bottom: 2px solid #e5e7eb;
  padding-bottom: 0;
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #6b7280;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.tab-btn:hover {
  color: #1a3a5c;
}

.tab-btn.active {
  color: #1a3a5c;
  border-bottom-color: #1a3a5c;
  font-weight: 600;
}

/* Form card */
.form-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

/* Form table */
.form-table {
  width: 100%;
  border-collapse: collapse;
}

.ft-th {
  padding: 0.75rem 1.25rem;
  text-align: left;
  font-weight: 600;
  font-size: 0.8125rem;
  color: #374151;
  background: #f9fafb;
  border-bottom: 2px solid #e5e7eb;
}

.ft-th-label {
  width: 35%;
}

.ft-th-answer {
  width: 65%;
}

.ft-row {
  border-bottom: 1px solid #f3f4f6;
}

.ft-row:last-child {
  border-bottom: none;
}

.ft-row-group {
  background: #f0f9ff;
}

.ft-row-child .ft-td-label {
  padding-left: 2rem;
}

.ft-td {
  padding: 0.875rem 1.25rem;
  vertical-align: top;
}

.ft-td-label {
  background: #fafbfc;
}

.ft-td-child {
  background: #f8fbff;
}

.ft-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  line-height: 1.5;
}

.ft-group-header {
  padding: 0.625rem 1.25rem;
  background: #f0f9ff;
  border-bottom: 1px solid #bfdbfe;
}

.ft-group-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1d4ed8;
}

/* Inputs */
.ft-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  background: #fff;
  color: #1f2937;
  box-sizing: border-box;
}

.ft-input:focus {
  border-color: #f0a500;
  box-shadow: 0 0 0 3px rgba(240, 165, 0, 0.1);
}

.ft-input-error {
  border-color: #ef4444 !important;
}

.ft-textarea {
  resize: vertical;
  min-height: 80px;
  font-family: 'Times New Roman', serif;
  font-size: 0.9rem;
  line-height: 1.5;
}

/* Date picker wrapper */
.ft-date-wrap {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.ft-date-input {
  flex: 1;
}

.ft-date-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  background: #f9fafb;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.ft-date-arrow:hover {
  background: #f0f9ff;
  border-color: #93c5fd;
  color: #1a3a5c;
}

.ft-date-arrow:active {
  background: #e0f2fe;
}

.ft-date-arrow:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ft-error {
  font-size: 0.75rem;
  color: #ef4444;
  margin-top: 0.25rem;
}

/* Radio */
.ft-radio-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.ft-radio-inline {
  flex-direction: row;
  flex-wrap: wrap;
}

.ft-radio-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: #374151;
  cursor: pointer;
  transition: all 0.15s;
}

.ft-radio-label:hover {
  background: #f9fafb;
  border-color: #d1d5db;
}

.ft-radio-selected {
  background: #f0fdf4;
  border-color: #86efac;
  color: #15803d;
}

.ft-radio-input {
  accent-color: #15803d;
}

/* Inner table (for table/dynamic_table types) */
.ft-table-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.ft-inner-table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  overflow: hidden;
}

.ft-inner-th {
  padding: 0.5rem 0.625rem;
  text-align: left;
  font-weight: 500;
  font-size: 0.75rem;
  color: #6b7280;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.ft-inner-td {
  padding: 0.25rem;
  border-bottom: 1px solid #f3f4f6;
}

.ft-stt {
  text-align: center;
  font-size: 0.75rem;
  color: #9ca3af;
  font-weight: 500;
}

.ft-inner-input {
  width: 100%;
  padding: 0.375rem 0.5rem;
  border: 1px solid transparent;
  border-radius: 0.25rem;
  font-size: 0.8125rem;
  outline: none;
  color: #1f2937;
  background: transparent;
  box-sizing: border-box;
}

.ft-inner-input:focus {
  border-color: #f0a500;
  background: #fff;
}

.ft-row-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  color: #9ca3af;
  cursor: pointer;
  border-radius: 0.25rem;
  transition: all 0.15s;
}

.ft-row-remove:hover {
  color: #ef4444;
  background: #fef2f2;
}

.ft-add-row-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.625rem;
  font-size: 0.75rem;
  color: #3b82f6;
  background: none;
  border: 1px dashed #bfdbfe;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.15s;
  align-self: flex-start;
}

.ft-add-row-btn:hover {
  background: #eff6ff;
  border-color: #93c5fd;
}

/* Dynamic table section */
.ft-dynatable-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ft-dynatable-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ft-dynatable-count {
  font-size: 0.75rem;
  color: #6b7280;
  background: #f3f4f6;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
}

.ft-dynatable-empty {
  text-align: center;
  padding: 1rem;
  color: #9ca3af;
  font-size: 0.8125rem;
  background: #f9fafb;
  border: 1px dashed #e5e7eb;
  border-radius: 0.375rem;
}

/* Cell radio (inside dynamic table) */
.ft-cell-radio {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.ft-cell-radio-label {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.375rem;
  font-size: 0.75rem;
  color: #6b7280;
  cursor: pointer;
  border-radius: 0.25rem;
  border: 1px solid transparent;
  transition: all 0.15s;
}

.ft-cell-radio-label:hover {
  background: #f9fafb;
}

.ft-cell-radio-selected {
  color: #15803d;
  background: #f0fdf4;
  border-color: #bbf7d0;
}

.ft-cell-radio-label input[type="radio"] {
  accent-color: #15803d;
  margin: 0;
}

.ft-cell-textarea {
  width: 100%;
  min-height: 60px;
  resize: vertical;
  font-size: 0.8rem;
  line-height: 1.4;
  padding: 0.375rem;
  font-family: inherit;
}

/* Computed */
.ft-computed-badge {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.0625rem 0.375rem;
  font-size: 0.625rem;
  font-weight: 500;
  color: #d97706;
  background: #fef3c7;
  border-radius: 0.25rem;
}

.ft-computed-value {
  padding: 0.5rem 0.75rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #92400e;
  min-height: 36px;
}

/* Submit bar */
.form-submit-bar {
  display: flex;
  justify-content: flex-end;
  padding: 1rem 1.25rem;
  border-top: 1px solid #f3f4f6;
}

.btn-submit {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.625rem 1.5rem;
  background: #15803d;
  color: #fff;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-submit:hover {
  background: #166534;
}

.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* History section */
.history-section {
  max-width: 960px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.15s;
}

.history-item:hover {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.history-item-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
  flex: 1;
}

.history-item-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #1f2937;
}

.history-item-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.75rem;
}

.history-status {
  display: inline-flex;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 500;
}

.history-status.completed {
  background: #d1fae5;
  color: #15803d;
}

.history-item-actions {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
  margin-left: 1rem;
}

.btn-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.375rem;
  border: 1px solid #e5e7eb;
  background: #fff;
  cursor: pointer;
  transition: all 0.15s;
  color: #6b7280;
}

.btn-view:hover {
  color: #1a3a5c;
  background: #f0f9ff;
  border-color: #bfdbfe;
}

.btn-download-action:hover {
  color: #15803d;
  background: #f0fdf4;
  border-color: #bbf7d0;
}

.btn-del:hover {
  color: #dc2626;
  background: #fef2f2;
  border-color: #fecaca;
}

/* History pagination */
.history-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1rem;
}

.page-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.375rem;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s;
}

.page-btn:hover:not(:disabled) {
  color: #1a3a5c;
  background: #f0f9ff;
  border-color: #bfdbfe;
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-info {
  font-size: 0.8125rem;
  color: #6b7280;
  font-weight: 500;
}

/* Locked (sequential) */
.ft-locked {
  opacity: 0.45;
  pointer-events: none;
  position: relative;
}

.ft-locked .ft-input,
.ft-locked .ft-inner-input {
  background: #f3f4f6;
  cursor: not-allowed;
}

.ft-lock-icon {
  font-size: 14px;
  color: #d1d5db;
  margin-left: 0.375rem;
  vertical-align: middle;
}

.ft-radio-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Mobile */
@media (max-width: 640px) {
  .ft-th-label {
    width: 40%;
  }

  .ft-th-answer {
    width: 60%;
  }

  .ft-td {
    padding: 0.625rem 0.75rem;
  }

  .form-submit-bar {
    padding: 0.75rem;
  }

  .ft-radio-inline {
    flex-direction: column;
  }
}

/* Modal xóa (tab Lịch sử) — cùng pattern với DigitizationHistory */
.delete-modal-root {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.delete-modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
}

.delete-modal-panel {
  position: relative;
  width: 100%;
  max-width: 400px;
  padding: 1.5rem;
  background: #fff;
  border-radius: 0.75rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  border: 1px solid #e5e7eb;
}

.delete-modal-icon-wrap {
  width: 48px;
  height: 48px;
  margin: 0 auto 1rem;
  border-radius: 9999px;
  background: #fef3c7;
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-modal-icon {
  font-size: 28px !important;
  color: #d97706;
}

.delete-modal-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: #1a3a5c;
  text-align: center;
  margin: 0 0 0.75rem;
}

.delete-modal-text {
  font-size: 0.875rem;
  color: #6b7280;
  line-height: 1.5;
  text-align: center;
  margin: 0 0 1.25rem;
}

.delete-modal-strong {
  color: #1f2937;
  font-weight: 600;
}

.delete-modal-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.delete-modal-btn {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 0.375rem;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s, opacity 0.15s;
}

.delete-modal-btn.cancel {
  background: #fff;
  border-color: #e5e7eb;
  color: #374151;
}

.delete-modal-btn.cancel:hover {
  background: #f9fafb;
}

.delete-modal-btn.danger {
  background: #dc2626;
  border-color: #dc2626;
  color: #fff;
}

.delete-modal-btn.danger:hover:not(:disabled) {
  background: #b91c1c;
  border-color: #b91c1c;
}

.delete-modal-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
</style>
