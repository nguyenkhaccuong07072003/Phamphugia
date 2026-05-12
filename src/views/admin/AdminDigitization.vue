<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import api from '../../api'
import {
  publicDepartments as departments,
  publicCompanies as companies,
  ensurePublicOrgLoaded,
} from '../../composables/useOrgLists'

interface Department {
  id: number
  name: string
  slug: string
}

interface TableColumn {
  key: string
  label: string
  type: 'text' | 'number' | 'radio' | 'select' | 'float' | 'textarea'
  options?: string[]
  valueMapping?: Record<string, string>  // e.g. { "Nam": "Ông", "Nữ": "Bà" }
  textReplace?: string  // e.g. "Ông/Bà" — text in Word to replace with mapped value
}

interface Question {
  key: string
  label: string
  type: 'text' | 'number' | 'float' | 'date' | 'time' | 'select' | 'textarea' | 'radio' | 'table' | 'group' | 'dynamic_table' | 'computed' | 'yes_no'
  required: boolean
  placeholder: string
  options: string[]
  columns: string[]
  // Group: sub-questions
  children?: Question[]
  // Dynamic table: number input triggers N-row table
  triggerKey?: string
  tableColumns?: TableColumn[]
  // Ref: reference data from another question's dynamic_table
  refKey?: string
  refColumns?: string[]
  // Computed: auto-calculate
  formula?: string
  formulaDeps?: string[]
  // Yes/No: condition-based auto text
  conditionRef?: string
  conditionOp?: string
  conditionValue?: string
  trueText?: string
  falseText?: string
  // Default value
  defaultValue?: any
  // Blank mapping: which blanks in the document this question fills
  blankIndex?: number | null  // legacy single
  blankIndices?: number[] | null  // new multi-blank
  // Fill rule: how to process value before filling blanks
  fillRule?: string | null
  // Dynamic table blank mapping: { colKey: [blankIdx_row0, blankIdx_row1, ...] }
  blankMapping?: Record<string, (number | null)[]> | null
  // Row pattern: auto-expand dynamic table rows in document
  rowPattern?: {
    templateRows: number
    blanksPerRow: number
    startBlank: number
    columnOrder: string[]
  } | null
  // Text replacement for radio/select (e.g. "Ông/Bà" → "Ông" or "Bà")
  valueMapping?: Record<string, string>
  textReplace?: string
  // Computed formula builder (UI-only, used to generate formula)
  _leftType?: string
  _leftVal?: string
  _op?: string
  _rightType?: string
  _rightVal?: string
}

interface BlankMeta {
  index: number
  label: string
  context: string
}

interface DocumentLine {
  lineNum: number
  text: string
  blanks: number[]
}

interface Template {
  id: number
  name: string
  slug: string
  description: string | null
  template_type: 'docx' | 'xlsx'
  template_file_url: string
  questions: Question[]
  blanks: BlankMeta[] | null
  category: string | null
  icon: string
  sort_order: number
  is_active: boolean
  created_at: string
  department_id: number | null
  department?: Department | null
  company_id: number | null
}

// State (departments / companies: cache dùng chung với TopBar — composables/useOrgLists)
const templates = ref<Template[]>([])
const loading = ref(false)
const uploading = ref(false)
const showForm = ref(false)
const editingId = ref<number | null>(null)
const deleteConfirmId = ref<number | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const formErrors = ref<Record<string, string>>({})
const parsedBlanks = ref<BlankMeta[]>([])
const documentLines = ref<DocumentLine[]>([])
const parsing = ref(false)

const searchQuery = ref('')
const filterDepartment = ref<number | ''>('')
// Lọc theo company: dùng number | null, không cần giá trị '0' đặc biệt
const filterCompany = ref<number | null>(null)
const searchTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
const page = ref(1)
const totalPages = ref(1)

const form = ref({
  name: '',
  description: '',
  template_type: 'docx' as 'docx' | 'xlsx',
  template_file_url: '',
  questions: [] as Question[],
  blanks: null as BlankMeta[] | null,
  category: '',
  icon: 'description',
  sort_order: 0,
  is_active: true,
  department_id: null as number | null,
  company_id: null as number | null,
})

async function fetchTemplates() {
  loading.value = true
  try {
    const params: Record<string, any> = { page: page.value, limit: 10 }
    if (searchQuery.value.trim()) params.search = searchQuery.value.trim()
    if (filterDepartment.value) params.department_id = filterDepartment.value
    if (filterCompany.value != null) {
      params.company_id = filterCompany.value
    }
    const { data } = await api.get('/admin/digitization/templates', { params })
    templates.value = data.data || []
    // Đồng bộ với cấu trúc paginatedResponse của backend (meta.total, meta.totalPages)
    const meta = data.meta || {}
    totalPages.value = meta.totalPages || 1
  } catch (e) {
    console.error('Failed to fetch templates:', e)
  } finally {
    loading.value = false
  }
}

function onSearch() {
  if (searchTimeout.value) clearTimeout(searchTimeout.value)
  page.value = 1
  searchTimeout.value = setTimeout(() => fetchTemplates(), 300)
}

function goToPage(p: number) {
  if (p < 1 || p > totalPages.value) return
  page.value = p
  fetchTemplates()
}

onMounted(() => {
  void ensurePublicOrgLoaded()
  fetchTemplates()
})

// Form actions
function openCreate() {
  editingId.value = null
  form.value = {
    name: '',
    description: '',
    template_type: 'docx',
    template_file_url: '',
    questions: [],
    blanks: null,
    category: '',
    icon: 'description',
    sort_order: 0,
    is_active: true,
    department_id: null,
    company_id: null,
  }
  parsedBlanks.value = []
  documentLines.value = []
  showForm.value = true
}

function openEdit(item: Template) {
  editingId.value = item.id
  form.value = {
    name: item.name,
    description: item.description || '',
    template_type: item.template_type,
    template_file_url: item.template_file_url,
    questions: JSON.parse(JSON.stringify(item.questions || [])),
    blanks: item.blanks ? JSON.parse(JSON.stringify(item.blanks)) : null,
    category: item.category || '',
    icon: item.icon || 'description',
    sort_order: item.sort_order,
    is_active: item.is_active,
    department_id: item.department_id || null,
    company_id: item.company_id || null,
  }
  parsedBlanks.value = item.blanks || []
  documentLines.value = [] // Will be populated on re-parse
  // Migrate legacy blankIndex → blankIndices + sync rowPattern
  for (const q of form.value.questions) {
    migrateBlankIndex(q)
    syncRowPattern(q)
    if (q.type === 'computed') parseFormulaToUI(q)
    if (q.children) {
      for (const child of q.children) {
        migrateBlankIndex(child)
        syncRowPattern(child)
        if (child.type === 'computed') parseFormulaToUI(child)
      }
    }
  }
  showForm.value = true
}

async function saveTemplate() {
  formErrors.value = {}
  sanitizeQuestionsForSave(form.value.questions)
  if (!form.value.template_file_url) formErrors.value.file = 'Vui lòng upload file template'
  if (!form.value.name.trim()) formErrors.value.name = 'Vui lòng nhập tên mẫu biểu'
  if (!form.value.department_id) formErrors.value.department = 'Vui lòng chọn phòng ban'
  if (form.value.questions.length === 0) formErrors.value.questions = 'Vui lòng thêm ít nhất 1 câu hỏi'

  // Sync rowPattern + validate
  for (const q of form.value.questions) {
    const checkRP = (item: Question, path: string) => {
      syncRowPattern(item)
      if (item.rowPattern && item.rowPattern.startBlank < 0) {
        formErrors.value.questions = `"${path}" — chưa chọn chỗ trống đầu tiên cho rowPattern`
      }
      if (item.rowPattern && item.rowPattern.blanksPerRow === 0) {
        formErrors.value.questions = `"${path}" — chưa có cột nào trong bảng`
      }
    }
    if (q.type === 'dynamic_table') checkRP(q, q.label)
    if (q.children) {
      for (const child of q.children) {
        if (child.type === 'dynamic_table') checkRP(child, `${q.label} > ${child.label}`)
      }
    }
  }

  if (Object.keys(formErrors.value).length > 0) return

  try {
    console.log('Saving template payload:', JSON.stringify(form.value, null, 2))
    if (editingId.value !== null) {
      await api.put(`/admin/digitization/templates/${editingId.value}`, form.value)
    } else {
      await api.post('/admin/digitization/templates', form.value)
    }
    showForm.value = false
    editingId.value = null
    fetchTemplates()
  } catch (e: any) {
    console.error('Failed to save template:', e)
    console.error('Response data:', JSON.stringify(e.response?.data, null, 2))
    const errData = e.response?.data
    if (errData?.errors?.length) {
      const details = errData.errors.map((err: any) => {
        const field = err.field || ''
        // Parse field path to get friendly location
        const qMatch = field.match(/questions\[(\d+)\]/)
        const cMatch = field.match(/children\[(\d+)\]/)
        const tMatch = field.match(/tableColumns\[(\d+)\]/)
        let location = ''
        if (qMatch) {
          const qIdx = parseInt(qMatch[1])
          const q = form.value.questions?.[qIdx]
          location = `Câu hỏi ${qIdx + 1}` + (q?.label ? ` "${q.label}"` : '')
        }
        if (cMatch) {
          const cIdx = parseInt(cMatch[1])
          location += ` → Câu con ${cIdx + 1}`
        }
        if (tMatch) {
          const tIdx = parseInt(tMatch[1])
          location += ` → Cột ${tIdx + 1}`
        }
        return `• ${location}: ${err.message}`
      }).join('\n')
      alert(`Lỗi khi lưu:\n\n${details}`)
    } else {
      alert(errData?.message || 'Lỗi khi lưu template')
    }
  }
}

function confirmDelete(id: number) {
  deleteConfirmId.value = id
}

async function deleteTemplate() {
  if (deleteConfirmId.value === null) return
  try {
    await api.delete(`/admin/digitization/templates/${deleteConfirmId.value}`)
    deleteConfirmId.value = null
    fetchTemplates()
  } catch (e) {
    console.error('Failed to delete template:', e)
  }
}

// File upload + auto parse placeholders
function triggerFileInput() {
  fileInput.value?.click()
}

async function handleFileUpload(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext !== 'docx' && ext !== 'xlsx') {
    alert('Chỉ hỗ trợ file .docx và .xlsx')
    target.value = ''
    return
  }

  form.value.template_type = ext as 'docx' | 'xlsx'

  // Step 1: Upload file
  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await api.post('/admin/files/upload?type=templates', formData)
    form.value.template_file_url = `/uploads${data.data.file_path}`
  } catch (err: any) {
    console.error('Upload failed:', err)
    alert(err.response?.data?.message || 'Lỗi khi tải file lên')
    uploading.value = false
    target.value = ''
    return
  }
  uploading.value = false
  target.value = ''

  // Auto-parse blanks from uploaded file
  await autoParseTemplate()
}

async function autoParseTemplate() {
  if (!form.value.template_file_url) return
  parsing.value = true
  try {
    const oldBlanks = [...parsedBlanks.value]
    const oldBlanksCount = oldBlanks.length
    const hadQuestions = form.value.questions.length > 0

    const { data } = await api.post('/admin/digitization/parse-placeholders', {
      file_url: form.value.template_file_url,
      template_type: form.value.template_type,
    })
    const newBlanks: BlankMeta[] = data.data.blanks || []
    parsedBlanks.value = newBlanks
    documentLines.value = data.data.documentLines || []
    form.value.blanks = data.data.blanks || null

    if (hadQuestions && oldBlanksCount > 0) {
      // Compare old vs new blanks to detect changes
      const changed = newBlanks.length !== oldBlanksCount ||
        newBlanks.some((b, i) => oldBlanks[i]?.label !== b.label)
      if (changed) {
        alert(
          `⚠ File mới có ${newBlanks.length} chỗ trống (trước đó: ${oldBlanksCount}).\n` +
          `Cấu trúc chỗ trống đã thay đổi.\n` +
          `Vui lòng kiểm tra lại mapping cho từng câu hỏi.`
        )
      }
    }

    // If no questions exist yet, auto-generate from parsed blanks
    if (!hadQuestions) {
      const qs = data.data.questions || []
      // Migrate blankIndex → blankIndices for parsed questions
      for (const q of qs) {
        migrateBlankIndex(q)
      }
      form.value.questions = qs
    }
  } catch (err: any) {
    console.error('Parse failed:', err)
  } finally {
    parsing.value = false
  }
}

function truncateContext(ctx: string, max: number): string {
  return ctx.length > max ? ctx.substring(0, max) + '...' : ctx
}

function blankOptionText(blank: BlankMeta, ctxLen = 45): string {
  return `#${blank.index + 1} [${blank.label}] — ${truncateContext(blank.context, ctxLen)}`
}

// Render a preview line with [___] replaced by highlighted blank markers
function renderPreviewLine(line: DocumentLine): string {
  let html = line.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  let blankIdx = 0
  html = html.replace(/\[___\]/g, () => {
    const globalIndex = line.blanks[blankIdx] ?? -1
    blankIdx++
    if (globalIndex < 0) return '<span class="blank-marker">?</span>'
    const blank = parsedBlanks.value.find(b => b.index === globalIndex)
    const label = blank?.label || '?'
    return `<span class="blank-marker" title="${label}">#${globalIndex + 1} ${label}</span>`
  })
  return html
}

// Group repeating lines: lines with same structure (same text after removing numbers and blank markers)
interface GroupedLine {
  lines: DocumentLine[]
  repeatCount: number
}

function getLineStructure(text: string): string {
  // Normalize: replace leading numbers "1." "2.1." etc with "N", and [___] with "X"
  return text
    .replace(/^\d+(\.\d+)*[.\)]\s*/, 'N. ')
    .replace(/\[___\]/g, 'X')
    .trim()
}

const groupedDocumentLines = computed<GroupedLine[]>(() => {
  const lines = documentLines.value
  if (lines.length === 0) return []

  const groups: GroupedLine[] = []
  let i = 0
  while (i < lines.length) {
    const structure = getLineStructure(lines[i]!.text)
    const blanksPerLine = lines[i]!.blanks.length
    // Look ahead for consecutive lines with same structure
    let j = i + 1
    while (j < lines.length) {
      const nextStructure = getLineStructure(lines[j]!.text)
      const nextBlanks = lines[j]!.blanks.length
      if (nextStructure === structure && nextBlanks === blanksPerLine) {
        j++
      } else {
        break
      }
    }
    groups.push({ lines: lines.slice(i, j), repeatCount: j - i })
    i = j
  }
  return groups
})

// Compute blankIndices from startBlank + fillRule
function computeBlankIndices(q: Question) {
  const start = q.blankIndex
  if (start == null || start < 0) {
    q.blankIndices = []
    return
  }
  if (q.fillRule === 'split_date') {
    q.blankIndices = [start, start + 1, start + 2]
  } else if (q.fillRule === 'split_time') {
    q.blankIndices = [start, start + 1]
  } else {
    q.blankIndices = [start]
  }
}

// Get fill rule description text
function getFillRuleNote(q: Question): string {
  const start = q.blankIndex
  if (start == null || start < 0) return ''
  if (q.fillRule === 'split_date') {
    return `#${start + 1} (ngày), #${start + 2} (tháng), #${start + 3} (năm)`
  }
  if (q.fillRule === 'split_time') {
    return `#${start + 1} (giờ), #${start + 2} (phút)`
  }
  return ''
}

// Dynamic table blank mapping helpers
function getBlankMappingSlots(q: Question, colKey: string): (number | null)[] {
  if (!q.blankMapping) q.blankMapping = {}
  if (!q.blankMapping[colKey]) q.blankMapping[colKey] = []
  return q.blankMapping[colKey] as (number | null)[]
}

function addBlankMappingSlot(q: Question, colKey: string) {
  if (!q.blankMapping) q.blankMapping = {}
  if (!q.blankMapping[colKey]) q.blankMapping[colKey] = []
  q.blankMapping[colKey]!.push(null as any)
}

// Row pattern helpers for dynamic_table
function toggleRowPattern(q: Question) {
  if (q.rowPattern) {
    q.rowPattern = null
  } else {
    const cols = (q.tableColumns || []).map(c => c.key)
    q.rowPattern = {
      templateRows: 3,
      blanksPerRow: cols.length,
      startBlank: -1, // -1 = chưa chọn, bắt user phải chọn
      columnOrder: cols,
    }
    q.blankMapping = null
  }
}

// Auto-sync rowPattern.columnOrder from current tableColumns
// blanksPerRow = number of actual blanks (dots) per row in the template
// textReplace columns don't occupy blanks, so exclude them from the default count
function syncRowPattern(q: Question) {
  if (!q.rowPattern) return
  const cols = (q.tableColumns || []).map(c => c.key)
  const fillableCols = (q.tableColumns || []).filter(c => !c.textReplace).length
  q.rowPattern.columnOrder = cols
  // Auto-correct: if blanksPerRow equals total cols (old value before textReplace fix), reset to fillable count
  const totalCols = cols.length
  if (!q.rowPattern.blanksPerRow || q.rowPattern.blanksPerRow === totalCols && fillableCols < totalCols) {
    q.rowPattern.blanksPerRow = fillableCols
  } else if (q.rowPattern.blanksPerRow < fillableCols) {
    q.rowPattern.blanksPerRow = fillableCols
  }
}

function getRowPatternPreview(q: Question): string[] {
  if (!q.rowPattern) return []
  const allCols = (q.tableColumns || [])
  // Separate fillable columns (occupy blanks) from textReplace columns (don't occupy blanks)
  const fillableCols = allCols.filter(c => !c.textReplace)
  const textReplaceCols = allCols.filter(c => c.textReplace)
  const startBlank = q.rowPattern.startBlank
  const blanksPerRow = q.rowPattern.blanksPerRow || fillableCols.length
  const templateRows = q.rowPattern.templateRows
  if (startBlank < 0) return ['⚠ Chưa chọn chỗ trống đầu tiên']
  const lines: string[] = []
  const previewRows = Math.min(templateRows + 2, 10)
  for (let row = 0; row < previewRows; row++) {
    const parts = fillableCols.map((col, colIdx) => {
      const blankIdx = startBlank + row * blanksPerRow + colIdx
      return `#${blankIdx + 1} (${col.label || col.key})`
    })
    const isExtra = row >= templateRows
    lines.push(`Dòng ${row + 1}: ${parts.join(', ')}${isExtra ? ' (tự thêm)' : ''}`)
  }
  if (textReplaceCols.length > 0) {
    lines.push(`Text thay thế: ${textReplaceCols.map(c => `"${c.textReplace}" ← ${c.label || c.key}`).join(', ')}`)
  }
  return lines
}

// Migration: ensure questions have both blankIndex (for dropdown) and blankIndices (for backend)
function migrateBlankIndex(q: Question) {
  // If blankIndices exists but blankIndex doesn't, set blankIndex to first element
  if (q.blankIndices && q.blankIndices.length > 0 && q.blankIndex == null) {
    q.blankIndex = q.blankIndices[0]
  }
  // If blankIndex exists but blankIndices doesn't, compute from blankIndex + fillRule
  if (q.blankIndex != null && (!q.blankIndices || q.blankIndices.length === 0)) {
    computeBlankIndices(q)
  }
  if (!q.blankIndices) q.blankIndices = []
}

const questionTypes = [
  { value: 'text', label: 'Văn bản' },
  { value: 'number', label: 'Số' },
  { value: 'float', label: 'Số thực' },
  { value: 'date', label: 'Ngày tháng' },
  { value: 'time', label: 'Giờ phút' },
  { value: 'textarea', label: 'Văn bản dài' },
  { value: 'radio', label: 'Chọn 1' },
  { value: 'select', label: 'Chọn (dropdown)' },
  { value: 'table', label: 'Bảng' },
  { value: 'group', label: 'Nhóm câu hỏi' },
  { value: 'dynamic_table', label: 'Bảng động (theo số)' },
  { value: 'computed', label: 'Tính toán tự động' },
  { value: 'yes_no', label: 'Có/Không tự động' },
]

const childQuestionTypes = [
  { value: 'text', label: 'Văn bản' },
  { value: 'number', label: 'Số' },
  { value: 'float', label: 'Số thực' },
  { value: 'date', label: 'Ngày tháng' },
  { value: 'time', label: 'Giờ phút' },
  { value: 'textarea', label: 'Văn bản dài' },
  { value: 'radio', label: 'Chọn 1' },
  { value: 'select', label: 'Chọn (dropdown)' },
  { value: 'table', label: 'Bảng' },
  { value: 'dynamic_table', label: 'Bảng động (theo số)' },
  { value: 'computed', label: 'Tính toán tự động' },
  { value: 'yes_no', label: 'Có/Không tự động' },
]

const tableColumnTypes = [
  { value: 'text', label: 'Văn bản' },
  { value: 'textarea', label: 'Văn bản dài' },
  { value: 'number', label: 'Số' },
  { value: 'float', label: 'Số thực' },
  { value: 'radio', label: 'Chọn 1' },
  { value: 'select', label: 'Chọn' },
]

function createEmptyQuestion(): Question {
  return {
    key: String(form.value.questions.length),
    label: '',
    type: 'text',
    required: true,
    placeholder: '',
    options: [],
    columns: [],
    blankIndices: [],
  }
}

function addQuestion() {
  form.value.questions.push(createEmptyQuestion())
}

function removeQuestion(index: number) {
  form.value.questions.splice(index, 1)
  form.value.questions.forEach((q, i) => { q.key = String(i) })
}

/** Đổi loại câu hỏi: xóa `children` nếu không còn là nhóm — tránh sót dữ liệu khi từng chọn "Nhóm" rồi đổi sang Bảng động/v.v. */
function onQuestionTypeChange(q: Question) {
  if (q.type !== 'group') {
    delete q.children
  }
}

/** Trước khi lưu: loại bỏ children khỏi câu không phải group (phòng trường hợp UI không kích hoạt @change). */
function sanitizeQuestionsForSave(questions: Question[]) {
  for (const q of questions) {
    if (q.type !== 'group') {
      delete q.children
    }
  }
}

function addOption(q: Question) {
  if (!q.options) q.options = []
  q.options.push('')
}

function removeOption(q: Question, optIndex: number) {
  q.options.splice(optIndex, 1)
}

function addColumn(q: Question) {
  if (!q.columns) q.columns = []
  q.columns.push('')
}

function removeColumn(q: Question, colIndex: number) {
  q.columns.splice(colIndex, 1)
}

// Group: add/remove sub-questions
function addChild(q: Question) {
  if (!q.children) q.children = []
  q.children.push({
    key: `${q.key}_${q.children.length}`,
    label: '',
    type: 'text',
    required: true,
    placeholder: '',
    options: [],
    columns: [],
    blankIndices: [],
  })
}

function removeChild(q: Question, childIndex: number) {
  q.children?.splice(childIndex, 1)
}

// Dynamic table: add/remove columns
function addTableColumn(q: Question) {
  if (!q.tableColumns) q.tableColumns = []
  q.tableColumns.push({ key: `col_${q.tableColumns.length}`, label: '', type: 'text' })
  syncRowPattern(q)
}

function removeTableColumn(q: Question, colIndex: number) {
  q.tableColumns?.splice(colIndex, 1)
  syncRowPattern(q)
}

function addTableColumnOption(col: TableColumn) {
  if (!col.options) col.options = []
  col.options.push('')
}

function removeTableColumnOption(col: TableColumn, optIndex: number) {
  col.options?.splice(optIndex, 1)
}

// Get only number/float question keys for triggerKey (số dòng) dropdowns
function getNumberQuestionKeys(): { key: string; label: string }[] {
  const result: { key: string; label: string }[] = []
  for (const q of form.value.questions) {
    if (q.type === 'number' || q.type === 'float') {
      result.push({ key: q.key, label: q.label || q.key })
    }
    if (q.type === 'group' && q.children) {
      const groupName = q.label || q.key
      for (const child of q.children) {
        if (child.type === 'number' || child.type === 'float') {
          result.push({ key: child.key, label: `[${groupName}] ${child.label || child.key}` })
        }
      }
    }
  }
  return result
}

// Get ALL question keys (main + children) for refKey dropdowns
function getAllQuestionKeys(): { key: string; label: string }[] {
  const result: { key: string; label: string }[] = []
  for (const q of form.value.questions) {
    result.push({ key: q.key, label: q.label || q.key })
    if (q.type === 'group' && q.children) {
      const groupName = q.label || q.key
      for (const child of q.children) {
        result.push({ key: child.key, label: `[${groupName}] ${child.label || child.key}` })
      }
    }
  }
  return result
}

function getDeptName(deptId: number | null) {
  if (!deptId) return '—'
  const dept = departments.value.find(d => d.id === deptId)
  return dept?.name || '—'
}

function getCompanyName(companyId: number | null) {
  if (!companyId) return 'Tất cả'
  const company = companies.value.find(c => c.id === companyId)
  return company?.name || '—'
}

function getTypeLabel(type: string): string {
  const found = questionTypes.find(t => t.value === type)
  return found?.label || type
}

// Get list of questions that can be referenced (for yes_no / computed)
function getRefCandidates(excludeKey: string): { key: string; label: string }[] {
  if (!form.value.questions) return []
  const result: { key: string; label: string }[] = []
  for (const q of form.value.questions) {
    if (q.key !== excludeKey && ['number', 'float', 'computed'].includes(q.type)) {
      result.push({ key: q.key, label: q.label })
    }
    if (q.type === 'group' && q.children) {
      for (const child of q.children) {
        if (child.key !== excludeKey && ['number', 'float', 'computed'].includes(child.type)) {
          result.push({ key: child.key, label: child.label })
        }
      }
    }
  }
  return result
}

// Build formula string from UI fields
function buildFormula(q: Question) {
  const left = q._leftType === 'ref' && q._leftVal ? `{${q._leftVal}}` : (q._leftVal || '')
  const right = q._rightType === 'ref' && q._rightVal ? `{${q._rightVal}}` : (q._rightVal || '')
  const op = q._op || '-'
  q.formula = left && right ? `${left} ${op} ${right}` : ''
}

// Parse existing formula back into UI fields (when editing)
function parseFormulaToUI(q: Question) {
  if (!q.formula) {
    q._leftType = 'number'; q._leftVal = ''; q._op = '-'; q._rightType = 'ref'; q._rightVal = ''
    return
  }
  const m = q.formula.match(/^(\{[^}]+\}|\d+(?:\.\d+)?)\s*([+\-*/×÷])\s*(\{[^}]+\}|\d+(?:\.\d+)?)$/)
  if (!m) {
    q._leftType = 'number'; q._leftVal = ''; q._op = '-'; q._rightType = 'ref'; q._rightVal = ''
    return
  }
  const parseOperand = (s: string): [string, string] => {
    const rm = s.match(/^\{(.+)\}$/)
    return rm ? ['ref', rm[1] || ''] : ['number', s]
  }
  const [lt, lv] = parseOperand(m[1] || '');
  const [rt, rv] = parseOperand(m[3] || '');
  q._leftType = lt; q._leftVal = lv
  q._op = m[2] === '×' ? '*' : m[2] === '÷' ? '/' : m[2]
  q._rightType = rt; q._rightVal = rv
}
</script>

<template>
  <div class="space-y-6">
    <!-- Page header -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">Quản lý mẫu biểu</h1>
        <p class="text-sm text-gray-500 mt-1">Tạo biểu mẫu với câu hỏi tùy chỉnh, hỗ trợ upload file Word/Excel</p>
      </div>
      <button class="btn-primary" @click="openCreate">
        <span class="material-icon text-base">add</span>
        Thêm mẫu biểu
      </button>
    </div>

    <!-- Filters -->
    <div class="filters-row">
      <div class="search-bar">
        <span class="material-icon search-icon">search</span>
        <input v-model="searchQuery" type="text" class="search-input" placeholder="Tìm kiếm..." @input="onSearch" />
        <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''; page = 1; fetchTemplates()">
          <span class="material-icon text-base">close</span>
        </button>
      </div>
      <select v-model="filterDepartment" class="filter-select" @change="page = 1; fetchTemplates()">
        <option value="">Tất cả phòng ban</option>
        <option v-for="dept in departments" :key="dept.id" :value="dept.id">{{ dept.name }}</option>
      </select>
      <select v-model="filterCompany" class="filter-select" @change="page = 1; fetchTemplates()">
        <option :value="null">Tất cả công ty</option>
        <option v-for="company in companies" :key="company.id" :value="company.id">{{ company.name }}</option>
      </select>
    </div>

    <!-- Templates table -->
    <div class="content-card">
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th class="table-th">Tên mẫu biểu</th>
              <th class="table-th" style="width:100px">Loại</th>
              <th class="table-th" style="width:140px">Phòng ban</th>
              <th class="table-th" style="width:130px">Công ty</th>
              <th class="table-th" style="width:80px">Trường</th>
              <th class="table-th" style="width:100px">Trạng thái</th>
              <th class="table-th text-center" style="width:100px">Thao tác</th>
            </tr>
          </thead>
          <tbody v-if="loading">
            <tr>
              <td colspan="7" class="py-10 text-center text-gray-400">Đang tải...</td>
            </tr>
          </tbody>
          <tbody v-else-if="templates.length === 0">
            <tr>
              <td colspan="7" class="py-10 text-center text-gray-400">Chưa có mẫu biểu nào</td>
            </tr>
          </tbody>
          <tbody v-else>
            <tr v-for="item in templates" :key="item.id" class="table-row" :class="{ 'opacity-50': !item.is_active }">
              <td class="table-td">
                <p class="font-medium text-gray-800">{{ item.name }}</p>
                <p v-if="item.description" class="text-xs text-gray-400 mt-0.5 truncate" style="max-width:300px">{{
                  item.description }}</p>
              </td>
              <td class="table-td">
                <span class="type-badge"
                  :style="item.template_type === 'docx' ? 'background:#dbeafe;color:#1d4ed8' : 'background:#d1fae5;color:#047857'">
                  {{ item.template_type === 'docx' ? 'Word' : 'Excel' }}
                </span>
              </td>
              <td class="table-td text-gray-500 text-sm">{{ getDeptName(item.department_id) }}</td>
              <td class="table-td text-gray-500 text-sm">{{ getCompanyName(item.company_id) }}</td>
              <td class="table-td text-center text-gray-500 text-sm">{{ item.questions?.length || 0 }}</td>
              <td class="table-td">
                <span class="status-badge"
                  :class="item.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'">
                  {{ item.is_active ? 'Hiện' : 'Ẩn' }}
                </span>
              </td>
              <td class="table-td">
                <div class="flex items-center justify-center gap-1">
                  <button class="action-btn action-btn-edit" @click="openEdit(item)" title="Sửa">
                    <span class="material-icon text-base">edit</span>
                  </button>
                  <button class="action-btn action-btn-delete" @click="confirmDelete(item.id)" title="Xóa">
                    <span class="material-icon text-base">delete</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="table-pagination">
        <button class="page-btn" :disabled="page <= 1" @click="goToPage(page - 1)">
          <span class="material-icon text-base">chevron_left</span>
        </button>
        <span class="page-info">{{ page }} / {{ totalPages }}</span>
        <button class="page-btn" :disabled="page >= totalPages" @click="goToPage(page + 1)">
          <span class="material-icon text-base">chevron_right</span>
        </button>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showForm" class="modal-overlay">
      <div class="modal-backdrop" @click="showForm = false" />
      <div class="modal-container modal-lg">
        <div class="modal-header">
          <h2 class="modal-title">{{ editingId !== null ? 'Chỉnh sửa mẫu biểu' : 'Thêm mẫu biểu mới' }}</h2>
          <button class="modal-close" @click="showForm = false">
            <span class="material-icon">close</span>
          </button>
        </div>

        <div class="modal-body">
          <!-- Upload file -->
          <div class="form-group">
            <label class="form-label">Upload file template <span class="text-red-500">*</span></label>
            <input ref="fileInput" type="file" accept=".docx,.xlsx" class="hidden" @change="handleFileUpload" />
            <div v-if="form.template_file_url" class="file-preview">
              <span class="material-icon text-base" style="color: #1a3a5c">
                {{ form.template_type === 'docx' ? 'article' : 'table_chart' }}
              </span>
              <span class="text-sm text-gray-700 flex-1 truncate">{{ form.template_file_url.split('/').pop() }}</span>
              <button type="button" class="text-sm text-blue-500 hover:underline" @click="triggerFileInput">
                Đổi file
              </button>
              <button type="button" class="text-sm text-orange-500 hover:underline" @click="autoParseTemplate"
                :disabled="parsing">
                {{ parsing ? 'Đang phân tích...' : 'Phân tích lại' }}
              </button>
            </div>
            <div v-if="parsedBlanks.length > 0" class="blanks-info">
              <span class="material-icon text-sm" style="color:#d97706">info</span>
              <span class="text-xs text-gray-500">Tìm thấy {{ parsedBlanks.length }} chỗ trống trong file.</span>
            </div>
            <button v-if="!form.template_file_url && documentLines.length === 0" type="button" class="upload-area"
              :class="{ 'upload-area-error': formErrors.file }" @click="triggerFileInput" :disabled="uploading">
              <span v-if="uploading" class="material-icon animate-spin">progress_activity</span>
              <span v-else class="material-icon text-3xl text-slate-400">cloud_upload</span>
              <span class="text-sm text-slate-500 mt-1">
                {{ uploading ? 'Đang tải lên...' : 'Nhấn để chọn file .docx hoặc .xlsx' }}
              </span>
            </button>
            <p v-if="formErrors.file" class="form-error">{{ formErrors.file }}</p>
          </div>

          <!-- 2-column layout: preview left, questions right -->
          <div class="editor-columns" :class="{ 'editor-columns-active': documentLines.length > 0 }">
            <!-- Left: File preview panel -->
            <div v-if="documentLines.length > 0" class="editor-col-preview">
              <div class="file-preview-panel">
                <div class="file-preview-header">
                  <span class="material-icon text-base" style="color:#4f46e5">description</span>
                  <span class="text-sm font-medium text-gray-700">Nội dung file</span>
                  <span class="text-xs text-gray-400">({{ parsedBlanks.length }} chỗ trống)</span>
                </div>
                <div class="file-preview-content">
                  <template v-for="(group, gi) in groupedDocumentLines" :key="gi">
                    <div v-if="group.repeatCount > 1" class="file-preview-group">
                      <div class="file-preview-line">
                        <span class="file-preview-text" v-html="renderPreviewLine(group.lines[0]!)"></span>
                      </div>
                      <div class="repeat-info">
                        <span class="material-icon" style="font-size:14px">repeat</span>
                        × {{ group.repeatCount }} dòng giống nhau
                        <span class="text-gray-400">(#{{ group.lines[0]!.blanks[0]! + 1 }} → #{{
                          group.lines[group.lines.length - 1]!.blanks[group.lines[group.lines.length - 1]!.blanks.length
                          - 1]! + 1 }})</span>
                      </div>
                    </div>
                    <template v-else>
                      <div v-for="line in group.lines" :key="line.lineNum" class="file-preview-line">
                        <span class="file-preview-text" v-html="renderPreviewLine(line)"></span>
                      </div>
                    </template>
                  </template>
                </div>
              </div>
            </div>

            <!-- Right: Questions builder -->
            <div class="editor-col-questions">
              <div class="form-group">
                <label class="form-label">Câu hỏi ({{ form.questions.length }})</label>

                <div v-if="form.questions.length > 0" class="questions-builder">
                  <div v-for="(q, i) in form.questions" :key="i" class="q-card" :class="'q-card-' + q.type">
                    <div class="q-card-header">
                      <span class="field-number">{{ i + 1 }}</span>
                      <span class="q-card-title">{{ q.label || 'Câu hỏi mới' }}</span>
                      <span class="q-type-badge">{{ getTypeLabel(q.type) }}</span>
                      <button type="button" class="q-remove-btn" @click="removeQuestion(i)" title="Xóa câu hỏi">
                        <span class="material-icon text-sm">close</span>
                      </button>
                    </div>
                    <div class="q-card-body">
                      <div class="q-row">
                        <input v-model="q.label" type="text" class="field-label-input flex-1"
                          placeholder="Tên câu hỏi *" />
                        <select v-model="q.type" class="q-type-select" @change="onQuestionTypeChange(q)">
                          <option v-for="t in questionTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
                        </select>
                      </div>

                      <!-- Blank mapping: which blanks in the document this question fills -->
                      <div v-if="parsedBlanks.length > 0 && !['group', 'computed'].includes(q.type)"
                        class="q-blank-section">
                        <div v-if="q.type === 'dynamic_table'" class="q-sub-section">
                          <div class="q-row" style="margin-bottom:6px">
                            <label class="text-xs" style="display:flex;align-items:center;gap:4px;cursor:pointer">
                              <input type="checkbox" :checked="!!q.rowPattern" @change="toggleRowPattern(q)" />
                              Tự nhân bản dòng (rowPattern)
                            </label>
                          </div>

                          <!-- rowPattern mode -->
                          <div v-if="q.rowPattern" class="q-sub-section"
                            style="padding-left:8px;border-left:2px solid #3b82f6">
                            <div class="q-row" style="gap:12px">
                              <div style="flex:1">
                                <span class="q-sub-label" style="font-size:0.75rem">Chỗ trống đầu tiên:</span>
                                <select v-model.number="q.rowPattern.startBlank" class="q-type-select"
                                  style="width:100%" :class="{ 'border-red-400': q.rowPattern.startBlank < 0 }">
                                  <option :value="-1" disabled>-- Chọn chỗ trống đầu tiên --</option>
                                  <option v-for="blank in parsedBlanks" :key="blank.index" :value="blank.index">
                                    {{ blankOptionText(blank, 35) }}
                                  </option>
                                </select>
                              </div>
                              <div style="width:100px">
                                <span class="q-sub-label" style="font-size:0.75rem">Số dòng trong file:</span>
                                <input type="number" v-model.number="q.rowPattern.templateRows" min="1"
                                  class="q-type-select" style="width:100%" />
                              </div>
                              <div style="width:120px">
                                <span class="q-sub-label" style="font-size:0.75rem">Blank/dòng:</span>
                                <input type="number" v-model.number="q.rowPattern.blanksPerRow"
                                  :min="(q.tableColumns || []).length" class="q-type-select" style="width:100%" />
                              </div>
                            </div>
                            <div class="text-xs text-gray-500" style="margin-top:4px">
                              Thứ tự cột: {{(q.tableColumns || []).map((c, i) => `${i + 1}. ${c.label ||
                                c.key}`).join(', ')}}
                              <span v-if="q.rowPattern!.blanksPerRow > (q.tableColumns || []).length">· {{
                                q.rowPattern!.blanksPerRow - (q.tableColumns || []).length }} blank thừa/dòng sẽ được
                                xóa
                              </span>
                            </div>
                            <div class="text-xs" style="margin-top:4px;color:#3b82f6">
                              <div v-for="(line, li) in getRowPatternPreview(q)" :key="li">{{ line }}</div>
                            </div>
                            <div class="text-xs text-green-600" style="margin-top:4px">
                              Nếu vùng chọn nằm trong bảng Word, hệ thống sẽ tự nhân bản/xóa dòng bảng; ngoài bảng thì sẽ nhân bản paragraph như cũ.
                            </div>
                          </div>

                          <!-- Manual blankMapping mode (backward compat) -->
                          <div v-else>
                            <span class="q-sub-label">Gán cột bảng vào chỗ trống trong file:</span>
                            <div v-for="col in (q.tableColumns || [])" :key="col.key" class="q-blank-mapping-row">
                              <span class="q-sub-label" style="font-size:0.8rem;min-width:80px">{{ col.label || col.key
                              }}:</span>
                              <div class="flex-1">
                                <div v-for="(_, ri) in getBlankMappingSlots(q, col.key)" :key="ri" class="q-option-row">
                                  <span class="text-xs text-gray-400" style="min-width:40px">Dòng {{ ri + 1 }}:</span>
                                  <select v-model="q.blankMapping![col.key]![ri]" class="q-type-select flex-1">
                                    <option :value="null">-- Bỏ qua --</option>
                                    <option v-for="blank in parsedBlanks" :key="blank.index" :value="blank.index">
                                      {{ blankOptionText(blank, 35) }}
                                    </option>
                                  </select>
                                </div>
                                <button type="button" class="q-add-sub-btn" @click="addBlankMappingSlot(q, col.key)">
                                  <span class="material-icon text-sm">add</span> Thêm dòng
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div v-else class="q-row flex-wrap gap-2">
                          <span class="q-sub-label" style="white-space:nowrap">Điền vào chỗ:</span>
                          <select v-model="q.blankIndex" class="q-type-select flex-1" @change="computeBlankIndices(q)">
                            <option :value="null">-- Không gán --</option>
                            <option v-for="blank in parsedBlanks" :key="blank.index" :value="blank.index">
                              {{ blankOptionText(blank, 50) }}
                            </option>
                          </select>
                        </div>
                        <!-- Fill rule (date: chỉ tách ngày/tháng/năm; time: chỉ tách giờ/phút) -->
                        <div v-if="q.blankIndex != null && ['date', 'time'].includes(q.type)" class="q-row">
                          <span class="q-sub-label" style="white-space:nowrap">Cách điền:</span>
                          <select v-model="q.fillRule" class="q-type-select flex-1" @change="computeBlankIndices(q)">
                            <option :value="null">Nguyên giá trị</option>
                            <option v-if="q.type === 'date'" value="split_date">Tách ngày/tháng/năm (3 chỗ)</option>
                            <option v-if="q.type === 'time'" value="split_time">Tách giờ/phút (2 chỗ)</option>
                          </select>
                        </div>
                        <!-- Fill rule note -->
                        <div v-if="getFillRuleNote(q)" class="q-row">
                          <span class="text-xs text-blue-500">Sẽ tự điền: {{ getFillRuleNote(q) }}</span>
                        </div>
                      </div>

                      <!-- Placeholder for simple types -->
                      <input v-if="['text', 'number', 'float', 'date'].includes(q.type)" v-model="q.placeholder"
                        type="text" class="field-label-input" placeholder="Gợi ý (placeholder)" />

                      <!-- Default value -->
                      <input v-if="['text', 'number', 'float'].includes(q.type)" v-model="q.defaultValue" type="text"
                        class="field-label-input" placeholder="Giá trị mặc định (tùy chọn)" />

                      <!-- Radio options -->
                      <div v-if="q.type === 'radio' || q.type === 'select'" class="q-sub-section">
                        <span class="q-sub-label">Lựa chọn:</span>
                        <div v-for="(_, oi) in q.options" :key="oi" class="q-option-row">
                          <input v-model="q.options[oi]" type="text" class="field-label-input flex-1"
                            :placeholder="'Lựa chọn ' + (oi + 1)" />
                          <input v-if="q.textReplace && q.options[oi]"
                            v-model="(q.valueMapping || (q.valueMapping = {}))[q.options[oi]!]" type="text"
                            class="field-label-input" style="width:80px" :placeholder="'→ ' + q.options[oi]" />
                          <button type="button" class="q-remove-btn" @click="removeOption(q, oi)">
                            <span class="material-icon text-sm">close</span>
                          </button>
                        </div>
                        <button type="button" class="q-add-sub-btn" @click="addOption(q)">
                          <span class="material-icon text-sm">add</span> Thêm lựa chọn
                        </button>
                        <div class="q-row" style="margin-top:4px">
                          <span class="q-sub-label" style="font-size:0.75rem;white-space:nowrap">Text thay thế:</span>
                          <input v-model="q.textReplace" type="text" class="field-label-input flex-1"
                            placeholder="VD: Ông/Bà (text trong Word cần thay)" />
                        </div>
                        <p v-if="q.textReplace" class="q-hint">Chọn "{{ q.options[0] || '...' }}" → thay "{{
                          q.textReplace }}" thành
                          "{{ q.valueMapping?.[q.options[0] || ''] || '...' }}" trong Word</p>
                      </div>

                      <!-- Table columns (static table) -->
                      <div v-if="q.type === 'table'" class="q-sub-section">
                        <span class="q-sub-label">Cột:</span>
                        <div v-for="(_, ci) in q.columns" :key="ci" class="q-option-row">
                          <input v-model="q.columns[ci]" type="text" class="field-label-input flex-1"
                            :placeholder="'Tên cột ' + (ci + 1)" />
                          <button type="button" class="q-remove-btn" @click="removeColumn(q, ci)">
                            <span class="material-icon text-sm">close</span>
                          </button>
                        </div>
                        <button type="button" class="q-add-sub-btn" @click="addColumn(q)">
                          <span class="material-icon text-sm">add</span> Thêm cột
                        </button>
                      </div>

                      <!-- GROUP: sub-questions -->
                      <div v-if="q.type === 'group'" class="q-sub-section q-group-section">
                        <span class="q-sub-label">Câu hỏi con:</span>
                        <div v-for="(child, ci) in (q.children || [])" :key="ci" class="q-child-card">
                          <div class="q-row">
                            <span class="q-child-num">{{ i + 1 }}.{{ ci + 1 }}</span>
                            <input v-model="child.label" type="text" class="field-label-input flex-1"
                              placeholder="Tên câu hỏi con" />
                            <select v-model="child.type" class="q-type-select q-type-select-sm">
                              <option v-for="t in childQuestionTypes" :key="t.value" :value="t.value">{{ t.label }}
                              </option>
                            </select>
                            <button type="button" class="q-remove-btn" @click="removeChild(q, ci)">
                              <span class="material-icon text-sm">close</span>
                            </button>
                          </div>
                          <input v-if="['text', 'number', 'float', 'date'].includes(child.type)"
                            v-model="child.placeholder" type="text" class="field-label-input"
                            placeholder="Placeholder" />
                          <!-- Child blank mapping -->
                          <div v-if="parsedBlanks.length > 0 && !['computed'].includes(child.type)"
                            class="q-blank-section">
                            <div v-if="child.type === 'dynamic_table'" class="q-sub-section">
                              <div class="q-row" style="margin-bottom:4px">
                                <label class="text-xs" style="display:flex;align-items:center;gap:4px;cursor:pointer">
                                  <input type="checkbox" :checked="!!child.rowPattern"
                                    @change="toggleRowPattern(child)" />
                                  Tự nhân bản dòng
                                </label>
                              </div>

                              <div v-if="child.rowPattern" class="q-sub-section"
                                style="padding-left:6px;border-left:2px solid #3b82f6">
                                <div class="q-row" style="gap:8px">
                                  <div style="flex:1">
                                    <span class="q-sub-label" style="font-size:0.7rem">Chỗ trống đầu:</span>
                                    <select v-model.number="child.rowPattern.startBlank" class="q-type-select"
                                      style="width:100%;font-size:0.75rem"
                                      :class="{ 'border-red-400': child.rowPattern.startBlank < 0 }">
                                      <option :value="-1" disabled>-- Chọn --</option>
                                      <option v-for="blank in parsedBlanks" :key="blank.index" :value="blank.index">
                                        {{ blankOptionText(blank, 25) }}
                                      </option>
                                    </select>
                                  </div>
                                  <div style="width:80px">
                                    <span class="q-sub-label" style="font-size:0.7rem">Dòng trong file:</span>
                                    <input type="number" v-model.number="child.rowPattern.templateRows" min="1"
                                      class="q-type-select" style="width:100%" />
                                  </div>
                                  <div style="width:90px">
                                    <span class="q-sub-label" style="font-size:0.7rem">Blank/dòng:</span>
                                    <input type="number" v-model.number="child.rowPattern.blanksPerRow"
                                      :min="(child.tableColumns || []).length" class="q-type-select"
                                      style="width:100%" />
                                  </div>
                                </div>
                                <div class="text-xs" style="margin-top:3px;color:#3b82f6">
                                  <div v-for="(line, li) in getRowPatternPreview(child)" :key="li">{{ line }}</div>
                                </div>
                              </div>

                              <div v-else>
                                <span class="q-sub-label" style="font-size:0.8rem">Gán cột bảng vào chỗ trống:</span>
                                <div v-for="col in (child.tableColumns || [])" :key="col.key"
                                  class="q-blank-mapping-row">
                                  <span class="q-sub-label" style="font-size:0.75rem;min-width:60px">{{ col.label ||
                                    col.key
                                  }}:</span>
                                  <div class="flex-1">
                                    <div v-for="(_, ri) in getBlankMappingSlots(child, col.key)" :key="ri"
                                      class="q-option-row">
                                      <span class="text-xs text-gray-400" style="min-width:35px">{{ ri + 1 }}:</span>
                                      <select v-model="child.blankMapping![col.key]![ri]" class="q-type-select flex-1">
                                        <option :value="null">--</option>
                                        <option v-for="blank in parsedBlanks" :key="blank.index" :value="blank.index">
                                          {{ blankOptionText(blank, 30) }}
                                        </option>
                                      </select>
                                    </div>
                                    <button type="button" class="q-add-sub-btn"
                                      @click="addBlankMappingSlot(child, col.key)">
                                      <span class="material-icon text-sm">add</span> Dòng
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div v-else class="q-row flex-wrap gap-1">
                              <span class="q-sub-label" style="white-space:nowrap;font-size:0.8rem">Điền vào chỗ:</span>
                              <select v-model="child.blankIndex" class="q-type-select flex-1"
                                @change="computeBlankIndices(child)">
                                <option :value="null">-- Không gán --</option>
                                <option v-for="blank in parsedBlanks" :key="blank.index" :value="blank.index">
                                  {{ blankOptionText(blank, 40) }}
                                </option>
                              </select>
                            </div>
                            <!-- Child fill rule -->
                            <div v-if="child.blankIndex != null && ['date', 'time'].includes(child.type)" class="q-row">
                              <span class="q-sub-label" style="white-space:nowrap;font-size:0.8rem">Cách điền:</span>
                              <select v-model="child.fillRule" class="q-type-select flex-1"
                                @change="computeBlankIndices(child)">
                                <option :value="null">Nguyên giá trị</option>
                                <option v-if="child.type === 'date'" value="split_date">Tách ngày/tháng/năm (3 chỗ)</option>
                                <option v-if="child.type === 'time'" value="split_time">Tách giờ/phút (2 chỗ)</option>
                              </select>
                            </div>
                            <div v-if="getFillRuleNote(child)" class="q-row">
                              <span class="text-xs text-blue-500">Sẽ tự điền: {{ getFillRuleNote(child) }}</span>
                            </div>
                          </div>
                          <!-- Child radio/select options -->
                          <div v-if="child.type === 'radio' || child.type === 'select'" class="q-child-options">
                            <div v-for="(_, coi) in child.options" :key="coi" class="q-option-row">
                              <input v-model="child.options[coi]" type="text" class="field-label-input flex-1"
                                :placeholder="'Lựa chọn ' + (coi + 1)" />
                              <input v-if="child.textReplace && child.options[coi]"
                                v-model="(child.valueMapping || (child.valueMapping = {}))[child.options[coi]!]"
                                type="text" class="field-label-input" style="width:80px"
                                :placeholder="'→ ' + child.options[coi]" />
                              <button type="button" class="q-remove-btn" @click="child.options.splice(coi, 1)">
                                <span class="material-icon text-sm">close</span>
                              </button>
                            </div>
                            <button type="button" class="q-add-sub-btn" @click="child.options.push('')">
                              <span class="material-icon text-sm">add</span> Thêm lựa chọn
                            </button>
                            <div class="q-row" style="margin-top:4px">
                              <span class="q-sub-label" style="font-size:0.75rem;white-space:nowrap">Text thay
                                thế:</span>
                              <input v-model="child.textReplace" type="text" class="field-label-input flex-1"
                                placeholder="VD: Ông/Bà (text trong Word cần thay)" />
                            </div>
                            <p v-if="child.textReplace" class="q-hint">Chọn "{{ child.options[0] || '...' }}" → thay "{{
                              child.textReplace }}" thành "{{ child.valueMapping?.[child.options[0] || ''] || '...' }}"
                              trong Word
                            </p>
                          </div>
                          <!-- Child table columns -->
                          <div v-if="child.type === 'table'" class="q-child-options">
                            <span class="q-sub-label" style="font-size:0.8rem">Cột bảng:</span>
                            <div v-for="(_, cci) in child.columns" :key="cci" class="q-option-row">
                              <input v-model="child.columns[cci]" type="text" class="field-label-input flex-1"
                                :placeholder="'Tên cột ' + (cci + 1)" />
                              <button type="button" class="q-remove-btn" @click="child.columns.splice(cci, 1)">
                                <span class="material-icon text-sm">close</span>
                              </button>
                            </div>
                            <button type="button" class="q-add-sub-btn" @click="child.columns.push('')">
                              <span class="material-icon text-sm">add</span> Thêm cột
                            </button>
                          </div>
                          <!-- Child dynamic_table config -->
                          <div v-if="child.type === 'dynamic_table'" class="q-child-options">
                            <div class="q-row">
                              <span class="q-sub-label" style="white-space:nowrap;font-size:0.8rem">Lấy số dòng
                                từ:</span>
                              <select v-model="child.triggerKey" class="q-type-select flex-1">
                                <option value="">-- Chọn câu hỏi --</option>
                                <option v-for="ck in getNumberQuestionKeys()" :key="ck.key" :value="ck.key">{{ ck.label
                                }}</option>
                              </select>
                            </div>
                            <span class="q-sub-label" style="font-size:0.8rem">Cột bảng:</span>
                            <div v-for="(col, cci) in (child.tableColumns || [])" :key="cci" class="q-tcol-card">
                              <div class="q-row">
                                <input v-model="col.label" type="text" class="field-label-input flex-1"
                                  placeholder="Tên cột" />
                                <input v-model="col.key" type="text" class="field-label-input" style="width:100px"
                                  placeholder="Key" />
                                <select v-model="col.type" class="q-type-select q-type-select-sm">
                                  <option v-for="t in tableColumnTypes" :key="t.value" :value="t.value">{{ t.label }}
                                  </option>
                                </select>
                                <button type="button" class="q-remove-btn" @click="removeTableColumn(child, cci)">
                                  <span class="material-icon text-sm">close</span>
                                </button>
                              </div>
                              <!-- Column options (for radio/select types) -->
                              <div v-if="col.type === 'radio' || col.type === 'select'" class="q-child-options">
                                <div v-for="(_, coi) in (col.options || [])" :key="coi" class="q-option-row">
                                  <input v-model="col.options![coi]" type="text" class="field-label-input flex-1"
                                    :placeholder="'Lựa chọn ' + (coi + 1)" />
                                  <input v-if="col.textReplace && col.options![coi]"
                                    v-model="(col.valueMapping || (col.valueMapping = {}))[col.options![coi]!]"
                                    type="text" class="field-label-input" style="width:80px"
                                    :placeholder="'→ ' + col.options![coi]" />
                                  <button type="button" class="q-remove-btn" @click="removeTableColumnOption(col, coi)">
                                    <span class="material-icon text-sm">close</span>
                                  </button>
                                </div>
                                <button type="button" class="q-add-sub-btn" @click="addTableColumnOption(col)">
                                  <span class="material-icon text-sm">add</span> Thêm lựa chọn
                                </button>
                                <div class="q-row" style="margin-top:4px">
                                  <span class="q-sub-label" style="font-size:0.75rem;white-space:nowrap">Text thay
                                    thế:</span>
                                  <input v-model="col.textReplace" type="text" class="field-label-input flex-1"
                                    placeholder="VD: Ông/Bà (text trong Word cần thay)" />
                                </div>
                                <p v-if="col.textReplace" class="q-hint">Chọn "{{ (col.options || [])[0] || '...' }}" →
                                  thay "{{
                                    col.textReplace }}" thành "{{ col.valueMapping?.[(col.options || [])[0] || ''] ||
                                    '...' }}" trong
                                  Word</p>
                              </div>
                            </div>
                            <button type="button" class="q-add-sub-btn" @click="addTableColumn(child)">
                              <span class="material-icon text-sm">add</span> Thêm cột
                            </button>
                          </div>
                          <!-- Child COMPUTED: formula builder -->
                          <div v-if="child.type === 'computed'" class="q-sub-section q-computed-section">
                            <span class="q-sub-label" style="font-size:0.8rem">Công thức tính:</span>
                            <div class="q-row" style="gap:4px;flex-wrap:wrap;align-items:center">
                              <select v-model="child._leftType" class="field-label-input" style="width:90px"
                                @change="buildFormula(child)">
                                <option value="number">Số</option>
                                <option value="ref">Câu hỏi</option>
                              </select>
                              <input v-if="!child._leftType || child._leftType === 'number'" v-model="child._leftVal"
                                type="text" class="field-label-input" style="width:70px" placeholder="100"
                                @input="buildFormula(child)" />
                              <select v-else v-model="child._leftVal" class="field-label-input" style="width:160px"
                                @change="buildFormula(child)">
                                <option value="">-- Chọn --</option>
                                <option v-for="ref in getRefCandidates(child.key)" :key="ref.key" :value="ref.key">{{
                                  ref.label }}
                                  ({{ ref.key }})</option>
                              </select>
                              <select v-model="child._op" class="field-label-input" style="width:50px;text-align:center"
                                @change="buildFormula(child)">
                                <option value="+">+</option>
                                <option value="-">−</option>
                                <option value="*">×</option>
                                <option value="/">/</option>
                              </select>
                              <select v-model="child._rightType" class="field-label-input" style="width:90px"
                                @change="buildFormula(child)">
                                <option value="number">Số</option>
                                <option value="ref">Câu hỏi</option>
                              </select>
                              <input v-if="!child._rightType || child._rightType === 'number'" v-model="child._rightVal"
                                type="text" class="field-label-input" style="width:70px" placeholder="0"
                                @input="buildFormula(child)" />
                              <select v-else v-model="child._rightVal" class="field-label-input" style="width:160px"
                                @change="buildFormula(child)">
                                <option value="">-- Chọn --</option>
                                <option v-for="ref in getRefCandidates(child.key)" :key="ref.key" :value="ref.key">{{
                                  ref.label }}
                                  ({{ ref.key }})</option>
                              </select>
                            </div>
                            <p class="q-hint" style="margin-top:4px">Kết quả: <code>{{ child.formula || '...' }}</code>
                            </p>
                          </div>
                          <!-- Child YES_NO: condition -->
                          <div v-if="child.type === 'yes_no'" class="q-sub-section q-computed-section">
                            <div class="q-row">
                              <span class="q-sub-label">Tham chiếu:</span>
                              <select v-model="child.conditionRef" class="field-label-input" style="width:200px">
                                <option value="">-- Chọn câu hỏi --</option>
                                <option v-for="ref in getRefCandidates(child.key)" :key="ref.key" :value="ref.key">{{
                                  ref.label }}
                                  ({{ ref.key }})</option>
                              </select>
                              <select v-model="child.conditionOp" class="field-label-input" style="width:80px">
                                <option value=">=">&ge;</option>
                                <option value="<=">&le;</option>
                                <option value=">">&gt;</option>
                                <option value="<">&lt;</option>
                                <option value="==">==</option>
                                <option value="!=">!=</option>
                              </select>
                              <input v-model="child.conditionValue" type="text" class="field-label-input"
                                style="width:80px" placeholder="Giá trị" />
                            </div>
                            <div class="q-row" style="margin-top:4px">
                              <span class="q-sub-label">Nếu đúng:</span>
                              <input v-model="child.trueText" type="text" class="field-label-input flex-1"
                                placeholder="VD: đủ điều kiện" />
                            </div>
                            <div class="q-row" style="margin-top:4px">
                              <span class="q-sub-label">Nếu sai:</span>
                              <input v-model="child.falseText" type="text" class="field-label-input flex-1"
                                placeholder="VD: không đủ điều kiện" />
                            </div>
                          </div>
                        </div>
                        <button type="button" class="q-add-sub-btn" @click="addChild(q)">
                          <span class="material-icon text-sm">add</span> Thêm câu hỏi con
                        </button>
                      </div>

                      <!-- DYNAMIC TABLE: trigger key + columns definition -->
                      <div v-if="q.type === 'dynamic_table'" class="q-sub-section q-dynatable-section">
                        <div class="q-row">
                          <span class="q-sub-label" style="white-space:nowrap">Lấy số dòng từ:</span>
                          <select v-model="q.triggerKey" class="q-type-select flex-1">
                            <option value="">-- Chọn câu hỏi số --</option>
                            <option v-for="qk in getNumberQuestionKeys()" :key="qk.key" :value="qk.key">{{ qk.label }}
                            </option>
                          </select>
                        </div>
                        <div class="q-row">
                          <span class="q-sub-label" style="white-space:nowrap">Tham chiếu bảng:</span>
                          <select v-model="q.refKey" class="q-type-select flex-1">
                            <option value="">-- Không --</option>
                            <option v-for="qk in getAllQuestionKeys()" :key="qk.key" :value="qk.key">{{ qk.label }}
                            </option>
                          </select>
                        </div>
                        <span class="q-sub-label">Cột bảng:</span>
                        <div v-for="(col, ci) in (q.tableColumns || [])" :key="ci" class="q-tcol-card">
                          <div class="q-row">
                            <input v-model="col.label" type="text" class="field-label-input flex-1"
                              placeholder="Tên cột" />
                            <input v-model="col.key" type="text" class="field-label-input" style="width:100px"
                              placeholder="Key" />
                            <select v-model="col.type" class="q-type-select q-type-select-sm">
                              <option v-for="t in tableColumnTypes" :key="t.value" :value="t.value">{{ t.label }}
                              </option>
                            </select>
                            <button type="button" class="q-remove-btn" @click="removeTableColumn(q, ci)">
                              <span class="material-icon text-sm">close</span>
                            </button>
                          </div>
                          <!-- Column options (for radio/select types) -->
                          <div v-if="col.type === 'radio' || col.type === 'select'" class="q-child-options">
                            <div v-for="(_, coi) in (col.options || [])" :key="coi" class="q-option-row">
                              <input v-model="col.options![coi]" type="text" class="field-label-input flex-1"
                                :placeholder="'Lựa chọn ' + (coi + 1)" />
                              <input v-if="col.textReplace && col.options![coi]"
                                v-model="(col.valueMapping || (col.valueMapping = {}))[col.options![coi]!]" type="text"
                                class="field-label-input" style="width:80px" :placeholder="'→ ' + col.options![coi]" />
                              <button type="button" class="q-remove-btn" @click="removeTableColumnOption(col, coi)">
                                <span class="material-icon text-sm">close</span>
                              </button>
                            </div>
                            <button type="button" class="q-add-sub-btn" @click="addTableColumnOption(col)">
                              <span class="material-icon text-sm">add</span> Thêm lựa chọn
                            </button>
                            <div class="q-row" style="margin-top:4px">
                              <span class="q-sub-label" style="font-size:0.75rem;white-space:nowrap">Text thay
                                thế:</span>
                              <input v-model="col.textReplace" type="text" class="field-label-input flex-1"
                                placeholder="VD: Ông/Bà (text trong Word cần thay)" />
                            </div>
                            <p v-if="col.textReplace" class="q-hint">Chọn "{{ (col.options || [])[0] || '...' }}" → thay
                              "{{
                                col.textReplace }}" thành "{{ col.valueMapping?.[(col.options || [])[0] || ''] || '...'
                              }}" trong Word
                            </p>
                          </div>
                        </div>
                        <button type="button" class="q-add-sub-btn" @click="addTableColumn(q)">
                          <span class="material-icon text-sm">add</span> Thêm cột
                        </button>
                      </div>

                      <!-- COMPUTED: formula builder -->
                      <div v-if="q.type === 'computed'" class="q-sub-section q-computed-section">
                        <span class="q-sub-label">Công thức tính:</span>
                        <div class="q-row" style="gap:4px;flex-wrap:wrap;align-items:center">
                          <!-- Left operand -->
                          <select v-model="q._leftType" class="field-label-input" style="width:90px"
                            @change="buildFormula(q)">
                            <option value="number">Số</option>
                            <option value="ref">Câu hỏi</option>
                          </select>
                          <input v-if="!q._leftType || q._leftType === 'number'" v-model="q._leftVal" type="text"
                            class="field-label-input" style="width:70px" placeholder="100" @input="buildFormula(q)" />
                          <select v-else v-model="q._leftVal" class="field-label-input" style="width:160px"
                            @change="buildFormula(q)">
                            <option value="">-- Chọn --</option>
                            <option v-for="ref in getRefCandidates(q.key)" :key="ref.key" :value="ref.key">{{ ref.label
                            }} ({{
                                ref.key }})</option>
                          </select>
                          <!-- Operator -->
                          <select v-model="q._op" class="field-label-input" style="width:50px;text-align:center"
                            @change="buildFormula(q)">
                            <option value="+">+</option>
                            <option value="-">−</option>
                            <option value="*">×</option>
                            <option value="/">/</option>
                          </select>
                          <!-- Right operand -->
                          <select v-model="q._rightType" class="field-label-input" style="width:90px"
                            @change="buildFormula(q)">
                            <option value="number">Số</option>
                            <option value="ref">Câu hỏi</option>
                          </select>
                          <input v-if="!q._rightType || q._rightType === 'number'" v-model="q._rightVal" type="text"
                            class="field-label-input" style="width:70px" placeholder="0" @input="buildFormula(q)" />
                          <select v-else v-model="q._rightVal" class="field-label-input" style="width:160px"
                            @change="buildFormula(q)">
                            <option value="">-- Chọn --</option>
                            <option v-for="ref in getRefCandidates(q.key)" :key="ref.key" :value="ref.key">{{ ref.label
                            }} ({{
                                ref.key }})</option>
                          </select>
                        </div>
                        <p class="q-hint" style="margin-top:4px">Kết quả: <code>{{ q.formula || '...' }}</code></p>
                      </div>

                      <!-- YES_NO: condition-based auto text -->
                      <div v-if="q.type === 'yes_no'" class="q-sub-section q-computed-section">
                        <div class="q-row">
                          <span class="q-sub-label">Tham chiếu:</span>
                          <select v-model="q.conditionRef" class="field-label-input" style="width:200px">
                            <option value="">-- Chọn câu hỏi --</option>
                            <option v-for="ref in getRefCandidates(q.key)" :key="ref.key" :value="ref.key">{{ ref.label
                            }} ({{
                                ref.key }})</option>
                          </select>
                          <select v-model="q.conditionOp" class="field-label-input" style="width:80px">
                            <option value=">=">&ge;</option>
                            <option value="<=">&le;</option>
                            <option value=">">&gt;</option>
                            <option value="<">&lt;</option>
                            <option value="==">==</option>
                            <option value="!=">!=</option>
                          </select>
                          <input v-model="q.conditionValue" type="text" class="field-label-input" style="width:80px"
                            placeholder="Giá trị" />
                        </div>
                        <div class="q-row" style="margin-top:4px">
                          <span class="q-sub-label">Nếu đúng:</span>
                          <input v-model="q.trueText" type="text" class="field-label-input flex-1"
                            placeholder="VD: đủ điều kiện tiến hành" />
                        </div>
                        <div class="q-row" style="margin-top:4px">
                          <span class="q-sub-label">Nếu sai:</span>
                          <input v-model="q.falseText" type="text" class="field-label-input flex-1"
                            placeholder="VD: không đủ điều kiện tiến hành" />
                        </div>
                        <p class="q-hint">Tự động điền text dựa vào giá trị câu hỏi khác. VD: {tong_ty_le} >= 65 → "đủ
                          điều kiện"
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-else class="empty-fields-neutral">
                  Chưa có câu hỏi nào.
                </div>
                <p v-if="formErrors.questions" class="form-error">{{ formErrors.questions }}</p>

                <button type="button" class="q-add-btn" @click="addQuestion">
                  <span class="material-icon text-base">add</span> Thêm câu hỏi
                </button>
              </div>
            </div>
          </div>

          <!-- Basic info -->
          <div class="form-group">
            <label class="form-label">Tên mẫu biểu <span class="text-red-500">*</span></label>
            <input v-model="form.name" type="text" class="form-input" :class="{ 'form-input-error': formErrors.name }"
              placeholder="VD: Biên bản họp nhà đầu tư" />
            <p v-if="formErrors.name" class="form-error">{{ formErrors.name }}</p>
          </div>

          <div class="form-group">
            <label class="form-label">Phòng ban <span class="text-red-500">*</span></label>
            <select v-model="form.department_id" class="form-input"
              :class="{ 'form-input-error': formErrors.department }">
              <option :value="null" disabled>-- Chọn phòng ban --</option>
              <option v-for="dept in departments" :key="dept.id" :value="dept.id">{{ dept.name }}</option>
            </select>
            <p v-if="formErrors.department" class="form-error">{{ formErrors.department }}</p>
          </div>

          <div class="form-group">
            <label class="form-label">Công ty (Tùy chọn)</label>
            <select v-model="form.company_id" class="form-input">
              <option :value="null">-- Không chọn (áp dụng cho tất cả công ty) --</option>
              <option v-for="company in companies" :key="company.id" :value="company.id">{{ company.name }}</option>
            </select>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-cancel" @click="showForm = false">Hủy</button>
          <button class="btn-primary" @click="saveTemplate">
            {{ editingId !== null ? 'Cập nhật' : 'Tạo mới' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete confirmation -->
    <div v-if="deleteConfirmId !== null" class="modal-overlay">
      <div class="modal-backdrop" @click="deleteConfirmId = null"></div>

      <div class="modal-container modal-sm">
        <div class="modal-body text-center flex flex-col items-center">

          <div class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <span class="material-icon text-red-500 text-2xl">warning</span>
          </div>

          <h3 class="text-lg font-semibold text-gray-800 mb-2 leading-6">
            Xác nhận xóa
          </h3>

          <p class="text-sm text-gray-500 mb-6 leading-8">
            Bạn có chắc chắn muốn xóa mẫu biểu này?
          </p>  

          <div class="flex gap-3 justify-center">
            <button class="btn-cancel" @click="deleteConfirmId = null">Hủy</button>
            <button class="btn-danger" @click="deleteTemplate">Xóa</button>
          </div>
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

.content-card {
  background: #fff;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.data-table {
  width: 100%;
  font-size: 0.875rem;
}

.table-th {
  padding: 0.75rem 1.25rem;
  text-align: left;
  font-weight: 500;
  color: #6b7280;
  background: #f9fafb;
  border-bottom: 1px solid #f3f4f6;
  white-space: nowrap;
}

.table-row {
  border-bottom: 1px solid #f9fafb;
  transition: background 0.15s ease;
}

.table-row:hover {
  background: #f9fafb;
}

.table-td {
  padding: 0.75rem 1.25rem;
}

.table-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.75rem 1.25rem;
  border-top: 1px solid #f3f4f6;
}

.page-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  background: #fff;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s;
}

.page-btn:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #d1d5db;
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-info {
  font-size: 0.8125rem;
  color: #6b7280;
}

.type-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 500;
}

.status-badge {
  display: inline-block;
  padding: 0.125rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.action-btn {
  padding: 0.375rem;
  border-radius: 0.5rem;
  border: none;
  cursor: pointer;
  transition: background 0.15s ease;
  background: none;
}

.action-btn-edit {
  color: #3b82f6;
}

.action-btn-edit:hover {
  background: #eff6ff;
}

.action-btn-delete {
  color: #ef4444;
}

.action-btn-delete:hover {
  background: #fef2f2;
}

/* Buttons */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #1a1a1a;
  color: #fff;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-primary:hover {
  background: #333;
}

.btn-cancel {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  color: #4b5563;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #fff;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-cancel:hover {
  background: #f9fafb;
}

.btn-danger {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  color: #fff;
  background: #ef4444;
  border: none;
  border-radius: 0.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-danger:hover {
  background: #dc2626;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
}

.modal-container {
  position: relative;
  background: #fff;
  border-radius: 0.75rem;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
  width: 100%;
  max-width: 40rem;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-lg {
  max-width: 52rem;
}

.modal-lg:has(.editor-columns-active) {
  max-width: 80rem;
}

.modal-sm {
  max-width: 24rem;
}

.modal-header {
  position: sticky;
  top: 0;
  background: #fff;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 0.75rem 0.75rem 0 0;
  z-index: 10;
}

.modal-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
}

.modal-close {
  color: #9ca3af;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.375rem;
  transition: color 0.15s;
}

.modal-close:hover {
  color: #4b5563;
}

.modal-body {
  padding: 1.5rem;
}

.modal-footer {
  position: sticky;
  bottom: 0;
  background: #fff;
  padding: 1rem 1.5rem;
  border-top: 1px solid #f3f4f6;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  border-radius: 0 0 0.75rem 0.75rem;
  z-index: 10;
}

/* Form */
.form-group {
  margin-bottom: 1.25rem;
}

.form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.375rem;
}

.form-input {
  width: 100%;
  padding: 0.625rem 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  background: #fff;
  color: #1f2937;
  box-sizing: border-box;
}

.form-input:focus {
  border-color: #f0a500;
  box-shadow: 0 0 0 3px rgba(240, 165, 0, 0.1);
}

.form-input-error {
  border-color: #ef4444 !important;
}

.form-error {
  font-size: 0.75rem;
  color: #ef4444;
  margin-top: 0.25rem;
}

/* File upload */
.upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 1.5rem;
  border: 2px dashed #d1d5db;
  border-radius: 0.5rem;
  background: #f9fafb;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.upload-area:hover {
  border-color: #f0a500;
  background: #fffbeb;
}

.upload-area:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.upload-area-error {
  border-color: #ef4444;
  background: #fef2f2;
}

.file-preview {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #f9fafb;
}

.blanks-info {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  background: #fefce8;
  border: 1px solid #fde68a;
  border-radius: 0.375rem;
}

/* 2-column editor layout */
.editor-columns {
  display: block;
}

.editor-columns-active {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 1rem;
  align-items: start;
}

.editor-col-preview {
  position: sticky;
  top: 0;
  max-height: calc(90vh - 10rem);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.editor-col-questions {
  min-width: 0;
}

/* File preview panel */
.file-preview-panel {
  border: 1px solid #e0e7ff;
  border-radius: 0.5rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: calc(90vh - 10rem);
}

.file-preview-header {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  background: #eef2ff;
  border-bottom: 1px solid #e0e7ff;
  flex-shrink: 0;
}

.file-preview-content {
  overflow-y: auto;
  padding: 0.5rem 0.75rem;
  background: #fafaff;
  flex: 1;
}

.file-preview-line {
  padding: 0.3rem 0;
  font-size: 0.78rem;
  color: #374151;
  line-height: 1.6;
  border-bottom: 1px solid #f3f4f6;
}

.file-preview-line:last-child {
  border-bottom: none;
}

.file-preview-group {
  background: #f0f9ff;
  border-left: 3px solid #3b82f6;
  padding: 4px 0 4px 8px;
  margin: 4px 0;
  border-radius: 0 4px 4px 0;
}

.repeat-info {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 0 2px 4px;
  font-size: 0.7rem;
  font-weight: 500;
  color: #2563eb;
}

.file-preview-text :deep(.blank-marker) {
  display: inline-block;
  padding: 1px 6px;
  margin: 0 2px;
  background: #fef08a;
  color: #92400e;
  border-radius: 3px;
  font-size: 0.65rem;
  font-weight: 600;
  border: 1px solid #fde68a;
  white-space: nowrap;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
}

.q-blank-section {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.375rem 0.5rem;
  background: #fefce8;
  border: 1px solid #fde68a;
  border-radius: 0.25rem;
}

.q-blank-mapping-row {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.25rem 0;
}

/* Question builder */
.field-label-input {
  flex: 1;
  min-width: 0;
  padding: 0.25rem 0.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.25rem;
  font-size: 0.8125rem;
  outline: none;
  background: #fff;
  color: #1f2937;
}

.field-label-input:focus {
  border-color: #f0a500;
}

.field-number {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #e5e7eb;
  color: #6b7280;
  font-size: 0.6875rem;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.empty-fields-neutral {
  text-align: center;
  padding: 1rem;
  color: #6b7280;
  font-size: 0.8125rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
}

.questions-builder {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.q-card {
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;
}

.q-card-group {
  border-color: #bfdbfe;
}

.q-card-dynamic_table {
  border-color: #c4b5fd;
}

.q-card-computed {
  border-color: #fbbf24;
}

.q-card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #f9fafb;
  border-bottom: 1px solid #f3f4f6;
}

.q-card-group .q-card-header {
  background: #eff6ff;
}

.q-card-dynamic_table .q-card-header {
  background: #f5f3ff;
}

.q-card-computed .q-card-header {
  background: #fffbeb;
}

.q-card-title {
  flex: 1;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #374151;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.q-type-badge {
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.625rem;
  font-weight: 500;
  color: #6b7280;
  background: #e5e7eb;
  white-space: nowrap;
}

.q-card-body {
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.q-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.q-type-select {
  padding: 0.25rem 0.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  outline: none;
  background: #fff;
  color: #374151;
  cursor: pointer;
  min-width: 110px;
}

.q-type-select-sm {
  min-width: 80px;
}

.q-type-select:focus {
  border-color: #f0a500;
}

.q-required-toggle {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  cursor: pointer;
  color: #6b7280;
  white-space: nowrap;
}

.q-required-toggle input {
  cursor: pointer;
}

.q-remove-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 0.25rem;
  border: none;
  background: none;
  color: #9ca3af;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.q-remove-btn:hover {
  color: #ef4444;
  background: #fef2f2;
}

.q-sub-section {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.5rem;
  background: #f9fafb;
  border-radius: 0.375rem;
}

.q-group-section {
  background: #f0f9ff;
}

.q-dynatable-section {
  background: #faf5ff;
}

.q-computed-section {
  background: #fefce8;
}

.q-sub-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: #6b7280;
}

.q-hint {
  font-size: 0.6875rem;
  color: #9ca3af;
  margin: 0;
}

.q-option-row {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.q-child-card {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.5rem;
  background: #fff;
  border: 1px solid #e0f2fe;
  border-radius: 0.375rem;
}

.q-child-num {
  font-size: 0.6875rem;
  font-weight: 600;
  color: #3b82f6;
  white-space: nowrap;
}

.q-child-options {
  padding-left: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.q-tcol-card {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.5rem;
  background: #fff;
  border: 1px solid #ede9fe;
  border-radius: 0.375rem;
}

.q-add-sub-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  color: #3b82f6;
  background: none;
  border: 1px dashed #bfdbfe;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.15s;
  align-self: flex-start;
}

.q-add-sub-btn:hover {
  background: #eff6ff;
  border-color: #93c5fd;
}

.q-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #15803d;
  background: #f0fdf4;
  border: 1px dashed #86efac;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.15s;
  margin-top: 0.25rem;
}

.q-add-btn:hover {
  background: #dcfce7;
  border-color: #4ade80;
}

/* Filters row */
.filters-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.search-bar {
  position: relative;
  display: flex;
  align-items: center;
  width: 280px;
}

.search-icon {
  position: absolute;
  left: 0.625rem;
  color: #9ca3af;
  font-size: 18px;
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 0.5rem 2rem 0.5rem 2.25rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  outline: none;
  background: #fff;
  color: #1f2937;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search-input:focus {
  border-color: #f0a500;
  box-shadow: 0 0 0 3px rgba(240, 165, 0, 0.1);
}

.search-input::placeholder {
  color: #9ca3af;
}

.search-clear {
  position: absolute;
  right: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 0.25rem;
  background: none;
  color: #9ca3af;
  cursor: pointer;
  transition: color 0.15s;
}

.search-clear:hover {
  color: #4b5563;
}

.filter-select {
  padding: 0.5rem 2rem 0.5rem 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  outline: none;
  background: #fff;
  color: #1f2937;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.625rem center;
}

.filter-select:focus {
  border-color: #f0a500;
  box-shadow: 0 0 0 3px rgba(240, 165, 0, 0.1);
}
</style>
