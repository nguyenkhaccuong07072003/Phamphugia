<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { publicApi } from '../api'

interface Department {
  id: number
  name: string
  slug: string
  phone: string | null
}

interface Template {
  id: number
  name: string
  slug: string
  description: string | null
  template_type: 'docx' | 'xlsx'
  category: string | null
  icon: string
  sort_order: number
}

const route = useRoute()
const router = useRouter()
const department = ref<Department | null>(null)
const templates = ref<Template[]>([])
const loading = ref(true)
const loadingTemplates = ref(false)
const page = ref(1)
const totalPages = ref(1)
const totalCount = ref(0)
const perPage = ref(10)
const search = ref('')
let searchTimeout: ReturnType<typeof setTimeout> | null = null

async function fetchData() {
  loading.value = true

  // reset state khi đổi phòng ban
  page.value = 1
  search.value = ''
  templates.value = []

  try {
    const { data } = await publicApi.get('/public/departments')
    const depts: Department[] = data.data || []
    department.value = depts.find(d => d.slug === route.params.slug) || null

    if (department.value) {
      await fetchTemplates()
    }
  } catch {
    department.value = null
  } finally {
    loading.value = false
  }
}

async function fetchTemplates() {
  loadingTemplates.value = true
  try {
    const params: Record<string, any> = {
      department_slug: route.params.slug,
      page: page.value,
      limit: perPage.value,
    }
    // Ưu tiên các query rõ ràng backend hỗ trợ: company_id / company_slug
    const rawCompanyId = route.query.company_id
    const rawCompanySlug = route.query.company_slug
    const rawCompany = route.query.company

    if (rawCompanyId != null) {
      const raw = String(rawCompanyId)
      if (raw === 'null') params.company_id = 'null'
      else params.company_id = raw
    } else if (rawCompanySlug != null) {
      const raw = String(rawCompanySlug)
      // backend hiểu "null" để chỉ lấy template có company_id IS NULL
      params.company_slug = raw
    } else if (rawCompany != null) {
      // ?company có thể là slug (chuỗi) hoặc id (số)
      const raw = String(rawCompany)
      if (raw === 'null') {
        params.company_slug = 'null'
      } else if (/^\d+$/.test(raw)) {
        params.company_id = raw
      } else {
        params.company_slug = raw
      }
    }
    if (search.value.trim()) params.search = search.value.trim()

    const res = await publicApi.get('/public/digitization/templates', { params })
    templates.value = res.data.data || []
    // Backend trả về phân trang trong res.data.meta.*
    const meta = res.data.meta || {}
    totalPages.value = meta.totalPages || 1
    totalCount.value = meta.total || 0
  } catch {
    templates.value = []
    totalPages.value = 1
    totalCount.value = 0
  } finally {
    loadingTemplates.value = false
  }
}

function onSearch() {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    page.value = 1
    fetchTemplates()
  }, 300)
}

function goToPage(p: number) {
  if (p < 1 || p > totalPages.value) return
  page.value = p
  fetchTemplates()
}

function openTemplate(slug: string) {
  // Giữ lại query lọc công ty để trang DigitizationForm/Back không bị mất filter.
  const query: Record<string, any> = {}
  if (route.query.company != null) query.company = route.query.company
  if (route.query.company_id != null) query.company_id = route.query.company_id
  if (route.query.company_slug != null) query.company_slug = route.query.company_slug

  router.push({
    name: 'digitization-form',
    params: { slug },
    query,
  })
}

function getTypeLabel(type: string) {
  return type === 'docx' ? 'Word' : 'Excel'
}

function getTypeColor(type: string) {
  return type === 'docx'
    ? 'background: #dbeafe; color: #1d4ed8'
    : 'background: #d1fae5; color: #047857'
}

// Visible page numbers for pagination
function getVisiblePages(): (number | '...')[] {
  const total = totalPages.value
  const cur = page.value
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '...')[] = [1]
  if (cur > 3) pages.push('...')
  for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) {
    pages.push(i)
  }
  if (cur < total - 2) pages.push('...')
  pages.push(total)
  return pages
}

onMounted(fetchData)
watch(
  () => [route.params.slug, route.query.company],
  fetchData
)
</script>

<template>
  <div class="w-full py-10 px-10 max-sm:px-3 max-sm:py-4">
    <div v-if="loading" class="text-center text-gray-400 py-20">Đang tải...</div>
    <div v-else-if="!department" class="text-center py-20">
      <p class="text-gray-500 text-lg">Không tìm thấy phòng ban</p>
      <router-link to="/" class="text-blue-500 text-sm mt-2 inline-block">Về trang chủ</router-link>
    </div>
    <div v-else>
      <!-- Title -->
      <h2 class="dept-title">
        <span class="title-bar"></span>
        {{ department.name }}
      </h2>

      <!-- Toolbar: search + count -->
      <div class="toolbar">
        <div class="search-box">
          <span class="material-icon search-icon">search</span>
          <input v-model="search" type="text" placeholder="Tìm kiếm biểu mẫu..." class="search-input"
            @input="onSearch" />
          <button v-if="search" class="search-clear" @click="search = ''; onSearch()">
            <span class="material-icon" style="font-size: 16px;">close</span>
          </button>
        </div>
        <span class="result-count">{{ totalCount }} biểu mẫu</span>
      </div>

      <!-- Table -->
      <div class="table-wrap">
        <div v-if="loadingTemplates" class="text-center text-gray-400 py-10">Đang tải...</div>

        <table v-else-if="templates.length > 0" class="dept-table">
          <thead>
            <tr>
              <th class="th-stt">STT</th>
              <th class="th-name">Tên biểu mẫu</th>
              <th class="th-type">Loại</th>
              <th class="th-action"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, idx) in templates" :key="item.id" class="table-row" @click="openTemplate(item.slug)">
              <td class="td-stt">{{ (page - 1) * perPage + idx + 1 }}</td>
              <td class="td-name">
                <div class="name-cell">
                  <span class="material-icon name-icon">{{ item.icon || 'description' }}</span>
                  <div>
                    <div class="name-text">{{ item.name }}</div>
                    <div v-if="item.description" class="name-desc">{{ item.description }}</div>
                  </div>
                </div>
              </td>
              <td class="td-type">
                <span class="type-badge" :style="getTypeColor(item.template_type)">
                  {{ getTypeLabel(item.template_type) }}
                </span>
              </td>
              <td class="td-action">
                <span class="material-icon arrow-icon">chevron_right</span>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-else class="empty-state">
          <span class="material-icon" style="font-size: 40px; color: #d1d5db;">search_off</span>
          <p>{{ search ? 'Không tìm thấy biểu mẫu nào' : 'Chưa có biểu mẫu nào cho phòng ban này' }}</p>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="pagination">
        <button class="page-btn" :disabled="page <= 1" @click="goToPage(page - 1)">
          <span class="material-icon" style="font-size: 16px;">chevron_left</span>
        </button>
        <template v-for="(p, pi) in getVisiblePages()" :key="pi">
          <span v-if="p === '...'" class="page-dots">...</span>
          <button v-else class="page-btn" :class="{ active: p === page }" @click="goToPage(p as number)">{{ p
            }}</button>
        </template>
        <button class="page-btn" :disabled="page >= totalPages" @click="goToPage(page + 1)">
          <span class="material-icon" style="font-size: 16px;">chevron_right</span>
        </button>
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

/* Title */
.dept-title {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 1.125rem;
  font-weight: 700;
  color: #1a3a5c;
  margin-bottom: 1.25rem;
  text-transform: uppercase;
}

.title-bar {
  width: 4px;
  height: 1.5rem;
  background: #f0a500;
  border-radius: 2px;
  flex-shrink: 0;
}

/* Toolbar */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  flex: 1;
  max-width: 360px;
  min-width: 200px;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
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
  color: #374151;
  background: #fff;
  outline: none;
  transition: border-color 0.15s;
}

.search-input:focus {
  border-color: #1a3a5c;
  box-shadow: 0 0 0 2px rgba(26, 58, 92, 0.08);
}

.search-input::placeholder {
  color: #9ca3af;
}

.search-clear {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 0.125rem;
  display: flex;
  align-items: center;
}

.search-clear:hover {
  color: #374151;
}

.result-count {
  font-size: 0.8125rem;
  color: #6b7280;
  white-space: nowrap;
}

/* Table */
.table-wrap {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;
}

.dept-table {
  width: 100%;
  border-collapse: collapse;
}

.dept-table th {
  text-align: left;
  padding: 0.75rem 1rem;
  background: #f8fafc;
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  border-bottom: 1px solid #e5e7eb;
}

.th-stt {
  width: 50px;
  text-align: center;
}

.th-name {
  text-align: left;
}

.th-type {
  width: 80px;
  text-align: center;
}

.th-action {
  width: 40px;
}

.table-row {
  cursor: pointer;
  transition: background 0.15s;
}

.table-row:hover {
  background: #f0fdf4;
}

.table-row td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #f3f4f6;
  font-size: 0.8125rem;
  color: #374151;
  vertical-align: middle;
}

.table-row:last-child td {
  border-bottom: none;
}

.td-stt {
  text-align: center;
  color: #9ca3af;
  font-size: 0.75rem;
}

.td-name {
  max-width: 0;
}

.name-cell {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.name-icon {
  font-size: 20px;
  color: #1a3a5c;
  margin-top: 1px;
  flex-shrink: 0;
}

.name-text {
  font-weight: 500;
  color: #1f2937;
  line-height: 1.4;
}

.name-desc {
  font-size: 0.75rem;
  color: #9ca3af;
  margin-top: 0.125rem;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.td-type {
  text-align: center;
}

.type-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 500;
}

.td-action {
  text-align: center;
}

.arrow-icon {
  color: #d1d5db;
  font-size: 18px;
  transition: color 0.15s;
}

.table-row:hover .arrow-icon {
  color: #15803d;
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 3rem 1rem;
  color: #9ca3af;
  font-size: 0.875rem;
}

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  margin-top: 1.25rem;
}

.page-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  height: 2rem;
  padding: 0 0.5rem;
  border-radius: 0.375rem;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #6b7280;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all 0.15s;
}

.page-btn:hover:not(:disabled):not(.active) {
  color: #1a3a5c;
  background: #f0f9ff;
  border-color: #bfdbfe;
}

.page-btn.active {
  background: #1a3a5c;
  color: #fff;
  border-color: #1a3a5c;
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-dots {
  color: #9ca3af;
  font-size: 0.75rem;
  padding: 0 0.25rem;
}

/* Responsive */
@media (max-width: 640px) {
  .dept-title {
    font-size: 1rem;
  }

  .title-bar {
    height: 1.25rem;
  }

  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .search-box {
    max-width: none;
  }

  .result-count {
    text-align: right;
  }

  .th-type,
  .td-type {
    display: none;
  }

  .dept-table th,
  .table-row td {
    padding: 0.5rem 0.75rem;
  }
}
</style>
