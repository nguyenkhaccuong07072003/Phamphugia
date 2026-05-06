<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'

interface Submission {
  id: number
  template_id: number
  status: string
  display_filename?: string
  display_filename_pdf?: string
  created_at?: string | null
  createdAt?: string | null
  template: {
    id: number
    name: string
    slug: string
    template_type: 'docx' | 'xlsx'
    icon: string
  }
}

const router = useRouter()
const submissions = ref<Submission[]>([])
const loading = ref(false)
const page = ref(1)
const totalPages = ref(1)

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

async function fetchSubmissions() {
  loading.value = true
  try {
    const { data } = await api.get('/admin/digitization/submissions', {
      params: { page: page.value, limit: 20 },
    })
    submissions.value = data.data
    totalPages.value = data.pagination?.totalPages || 1
  } catch (e) {
    console.error('Failed to fetch submissions:', e)
  } finally {
    loading.value = false
  }
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

function formatDate(dateStr: string) {
  // Chống hiển thị "Invalid Date" khi backend trả thiếu/null hoặc format lạ.
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

function goToPage(p: number) {
  if (p < 1 || p > totalPages.value) return
  page.value = p
  fetchSubmissions()
}

onMounted(fetchSubmissions)
</script>

<template>
  <div class="w-full py-10 px-10 max-sm:px-3 max-sm:py-4">
    <!-- Header -->
    <div class="mb-6">
      <button class="btn-back" @click="router.back()">
        <span class="material-icon text-base">arrow_back</span> Quay lại
      </button>
    </div>

    <div class="page-header mb-6">
      <div class="flex items-center gap-3">
        <div class="header-icon">
          <span class="material-icon" style="font-size: 28px; color: #1a3a5c">history</span>
        </div>
        <div>
          <h1 class="text-xl font-bold" style="color: #1a3a5c">Văn bản đã tạo</h1>
          <p class="text-sm text-gray-500">Lịch sử các văn bản bạn đã điền và tạo</p>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="text-gray-400">Đang tải...</div>
    </div>

    <!-- Empty -->
    <div v-else-if="submissions.length === 0" class="empty-state">
      <span class="material-icon" style="font-size: 48px; color: #d1d5db">description</span>
      <p class="text-gray-400 mt-3">Chưa có văn bản nào được tạo</p>
    </div>

    <!-- Submissions list -->
    <div v-else class="submissions-list">
      <div
        v-for="sub in submissions"
        :key="sub.id"
        class="submission-card"
      >
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <div class="template-icon-sm">
            <span class="material-icon">{{ sub.template.icon || 'description' }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="submission-name">{{ sub.template.name }}</h3>
            <p class="submission-meta">
              <span class="type-badge" :class="sub.template.template_type">
                {{ sub.template.template_type === 'docx' ? 'Word' : 'Excel' }}
              </span>
              {{ formatDate(sub.created_at ?? (sub as any).createdAt) }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button class="btn-view" @click="viewResult(sub.id)" title="Xem chi tiết">
            <span class="material-icon text-base">visibility</span>
            Xem
          </button>
          <button class="btn-dl" @click="downloadFile(sub)" title="Tải về">
            <span class="material-icon text-base">download</span>
          </button>
          <button class="btn-delete" @click="openDeleteModal(sub)" title="Xóa">
            <span class="material-icon text-base">delete</span>
          </button>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="pagination">
        <button
          class="page-btn"
          :disabled="page <= 1"
          @click="goToPage(page - 1)"
        >
          <span class="material-icon text-base">chevron_left</span>
        </button>
        <span class="page-info">{{ page }} / {{ totalPages }}</span>
        <button
          class="page-btn"
          :disabled="page >= totalPages"
          @click="goToPage(page + 1)"
        >
          <span class="material-icon text-base">chevron_right</span>
        </button>
      </div>
    </div>

    <!-- Cảnh báo xóa (modal, không dùng form HTML) -->
    <Teleport to="body">
      <div
        v-if="deleteModalOpen && submissionToDelete"
        class="delete-modal-root"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
      >
        <div class="delete-modal-backdrop" @click="!deleteSubmitting && closeDeleteModal()" />
        <div class="delete-modal-panel">
          <div class="delete-modal-icon-wrap" aria-hidden="true">
            <span class="material-icon delete-modal-icon">warning</span>
          </div>
          <h2 id="delete-modal-title" class="delete-modal-title">Xóa văn bản?</h2>
          <p class="delete-modal-text">
            Bạn có chắc muốn xóa
            <strong class="delete-modal-strong">“{{ submissionToDelete.template.name }}”</strong>?
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

.btn-back:hover {
  color: #1a3a5c;
}

.page-header {
  padding: 1rem 1.5rem;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.header-icon {
  width: 48px;
  height: 48px;
  border-radius: 0.75rem;
  background: #f0f9ff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.empty-state {
  text-align: center;
  padding: 4rem 0;
}

.submissions-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.submission-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.submission-card:hover {
  border-color: #d1d5db;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}

.template-icon-sm {
  width: 40px;
  height: 40px;
  border-radius: 0.5rem;
  background: #f0f9ff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.template-icon-sm .material-icon {
  font-size: 22px;
  color: #1a3a5c;
}

.submission-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.submission-meta {
  font-size: 0.8125rem;
  color: #9ca3af;
  margin-top: 0.125rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.type-badge {
  display: inline-block;
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.type-badge.docx {
  background: #dbeafe;
  color: #1d4ed8;
}

.type-badge.xlsx {
  background: #dcfce7;
  color: #15803d;
}

.btn-view {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #1a3a5c;
  background: #f0f9ff;
  border: 1px solid #bfdbfe;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-view:hover {
  background: #dbeafe;
}

.btn-dl {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  color: #15803d;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-dl:hover {
  background: #dcfce7;
}

.btn-delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  color: #dc2626;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-delete:hover {
  background: #fee2e2;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 1rem;
  padding-top: 1rem;
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

/* Modal xóa */
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
