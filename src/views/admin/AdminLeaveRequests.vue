<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import api from '../../api'

interface LeaveRequest {
  id: number
  employee_id: number
  leave_type: string
  start_date: string
  end_date: string
  total_days: number
  reason: string
  status: string
  approved_at: string | null
  reject_reason: string | null
  employee?: {
    id: number
    full_name: string
    employee_code: string
    department?: { id: number; name: string }
  }
  approver?: { id: number; full_name: string }
}

const requests = ref<LeaveRequest[]>([])
const employees = ref<any[]>([])
const loading = ref(false)
const showForm = ref(false)
const showRejectModal = ref(false)
const rejectingId = ref<number | null>(null)
const rejectReason = ref('')

const filterStatus = ref('')
const filterType = ref('')
const currentPage = ref(1)
const totalPages = ref(1)
const totalItems = ref(0)
const perPage = ref(15)

const leaveTypeLabels: Record<string, string> = {
  annual: 'Phép năm',
  sick: 'Nghỉ ốm',
  maternity: 'Thai sản',
  wedding: 'Nghỉ cưới',
  funeral: 'Nghỉ tang',
  unpaid: 'Không lương',
  other: 'Khác',
}

const leaveTypeClasses: Record<string, string> = {
  annual: 'lt-annual',
  sick: 'lt-sick',
  maternity: 'lt-maternity',
  wedding: 'lt-wedding',
  funeral: 'lt-funeral',
  unpaid: 'lt-unpaid',
  other: 'lt-other',
}

const statusLabels: Record<string, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  cancelled: 'Đã hủy',
}

const form = ref({
  employee_id: '' as string | number,
  leave_type: 'annual',
  start_date: '',
  end_date: '',
  total_days: 1,
  reason: '',
})

async function fetchRequests() {
  loading.value = true
  try {
    const params: any = { page: currentPage.value, limit: perPage.value }
    if (filterStatus.value) params.status = filterStatus.value
    if (filterType.value) params.leave_type = filterType.value

    const { data } = await api.get('/admin/leave-requests', { params })
    requests.value = data.data
    totalPages.value = data.meta.totalPages
    totalItems.value = data.meta.total
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

async function fetchEmployees() {
  try {
    const { data } = await api.get('/admin/employees', { params: { limit: 500, status: 'active' } })
    employees.value = data.data
  } catch (e) { console.error(e) }
}

function openForm() {
  form.value = { employee_id: '', leave_type: 'annual', start_date: '', end_date: '', total_days: 1, reason: '' }
  showForm.value = true
}

async function saveRequest() {
  if (!form.value.employee_id || !form.value.start_date || !form.value.end_date || !form.value.reason) {
    return alert('Vui lòng điền đầy đủ thông tin')
  }
  try {
    await api.post('/admin/leave-requests', form.value)
    showForm.value = false
    fetchRequests()
  } catch (e: any) { alert(e.response?.data?.message || 'Có lỗi xảy ra') }
}

async function approveRequest(id: number) {
  try {
    await api.put(`/admin/leave-requests/${id}/approve`)
    fetchRequests()
  } catch (e: any) { alert(e.response?.data?.message || 'Có lỗi xảy ra') }
}

function openReject(id: number) {
  rejectingId.value = id
  rejectReason.value = ''
  showRejectModal.value = true
}

async function rejectRequest() {
  if (!rejectingId.value) return
  try {
    await api.put(`/admin/leave-requests/${rejectingId.value}/reject`, { reject_reason: rejectReason.value })
    showRejectModal.value = false
    rejectingId.value = null
    fetchRequests()
  } catch (e: any) { alert(e.response?.data?.message || 'Có lỗi xảy ra') }
}

async function deleteRequest(id: number) {
  if (!confirm('Xóa đơn nghỉ phép này?')) return
  try {
    await api.delete(`/admin/leave-requests/${id}`)
    fetchRequests()
  } catch (e: any) { alert(e.response?.data?.message || 'Có lỗi xảy ra') }
}

// Tự tính ngày nghỉ
watch([() => form.value.start_date, () => form.value.end_date], ([s, e]) => {
  if (s && e) {
    const start = new Date(s)
    const end = new Date(e)
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    form.value.total_days = Math.max(0.5, diff)
  }
})

function formatDate(d: string | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('vi-VN')
}

watch([filterStatus, filterType], () => { currentPage.value = 1; fetchRequests() })
watch(currentPage, () => fetchRequests())

const paginationPages = computed(() => {
  const pages: (number | string)[] = []
  const total = totalPages.value
  const cur = currentPage.value
  if (total <= 7) { for (let i = 1; i <= total; i++) pages.push(i) }
  else {
    pages.push(1)
    if (cur > 3) pages.push('...')
    for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i)
    if (cur < total - 2) pages.push('...')
    pages.push(total)
  }
  return pages
})

onMounted(() => { fetchRequests(); fetchEmployees() })
</script>

<template>
  <div class="page-header">
    <h2 class="page-title">Quản lý nghỉ phép</h2>
    <button class="btn-primary" @click="openForm"><span class="material-icon">add</span> Tạo đơn nghỉ</button>
  </div>

  <div class="content-card">
    <div class="filter-bar">
      <select v-model="filterStatus" class="filter-select">
        <option value="">Tất cả trạng thái</option>
        <option value="pending">Chờ duyệt</option>
        <option value="approved">Đã duyệt</option>
        <option value="rejected">Từ chối</option>
        <option value="cancelled">Đã hủy</option>
      </select>
      <select v-model="filterType" class="filter-select">
        <option value="">Tất cả loại nghỉ</option>
        <option v-for="(label, key) in leaveTypeLabels" :key="key" :value="key">{{ label }}</option>
      </select>
    </div>

    <div class="overflow-x-auto">
      <table class="data-table">
        <thead><tr>
          <th class="table-th">Nhân viên</th>
          <th class="table-th">Phòng ban</th>
          <th class="table-th">Loại nghỉ</th>
          <th class="table-th">Từ ngày</th>
          <th class="table-th">Đến ngày</th>
          <th class="table-th" style="text-align:center">Số ngày</th>
          <th class="table-th">Lý do</th>
          <th class="table-th">Trạng thái</th>
          <th class="table-th" style="width:130px">Thao tác</th>
        </tr></thead>
        <tbody>
          <tr v-if="loading"><td colspan="9" class="table-td" style="text-align:center;padding:2rem">Đang tải...</td></tr>
          <tr v-else-if="requests.length === 0"><td colspan="9" class="table-td" style="text-align:center;padding:2rem;color:#999">Không có đơn nào</td></tr>
          <tr v-for="r in requests" :key="r.id" class="table-row">
            <td class="table-td">
              <div><strong>{{ r.employee?.employee_code }}</strong></div>
              <div style="font-size:0.8rem;color:#666">{{ r.employee?.full_name }}</div>
            </td>
            <td class="table-td">{{ r.employee?.department?.name || '—' }}</td>
            <td class="table-td"><span class="type-tag" :class="leaveTypeClasses[r.leave_type]">{{ leaveTypeLabels[r.leave_type] || r.leave_type }}</span></td>
            <td class="table-td">{{ formatDate(r.start_date) }}</td>
            <td class="table-td">{{ formatDate(r.end_date) }}</td>
            <td class="table-td" style="text-align:center;font-weight:600">{{ r.total_days }}</td>
            <td class="table-td" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" :title="r.reason">{{ r.reason }}</td>
            <td class="table-td">
              <span class="status-badge" :class="'st-' + r.status">{{ statusLabels[r.status] }}</span>
              <div v-if="r.reject_reason" style="font-size:0.7rem;color:#dc2626;margin-top:2px">{{ r.reject_reason }}</div>
            </td>
            <td class="table-td">
              <div style="display:flex;gap:4px">
                <template v-if="r.status === 'pending'">
                  <button class="action-btn action-btn-approve" title="Duyệt" @click="approveRequest(r.id)"><span class="material-icon">check</span></button>
                  <button class="action-btn action-btn-reject" title="Từ chối" @click="openReject(r.id)"><span class="material-icon">close</span></button>
                </template>
                <button class="action-btn action-btn-delete" title="Xóa" @click="deleteRequest(r.id)"><span class="material-icon">delete</span></button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="totalPages > 1" class="pagination-bar">
      <div class="pagination-left"><span class="pagination-info">{{ totalItems }} đơn</span></div>
      <div class="pagination-center">
        <button class="pagination-btn" :disabled="currentPage <= 1" @click="currentPage--">‹</button>
        <template v-for="p in paginationPages" :key="p">
          <span v-if="p === '...'" class="pagination-dots">...</span>
          <button v-else class="pagination-btn" :class="{ 'pagination-btn-active': p === currentPage }" @click="currentPage = p as number">{{ p }}</button>
        </template>
        <button class="pagination-btn" :disabled="currentPage >= totalPages" @click="currentPage++">›</button>
      </div>
      <div class="pagination-right"></div>
    </div>
  </div>

  <!-- Modal Tạo đơn nghỉ -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showForm" class="modal-overlay">
        <div class="modal-backdrop" @click="showForm = false"></div>
        <div class="modal-container" style="max-width:32rem">
          <div class="modal-header">
            <h3 class="modal-title">Tạo đơn nghỉ phép</h3>
            <button class="modal-close" @click="showForm = false"><span class="material-icon">close</span></button>
          </div>
          <div class="modal-body">
            <div class="form-stack">
              <div class="form-group">
                <label class="form-label">Nhân viên <span style="color:red">*</span></label>
                <select v-model="form.employee_id" class="form-input">
                  <option value="">-- Chọn nhân viên --</option>
                  <option v-for="e in employees" :key="e.id" :value="e.id">{{ e.employee_code }} - {{ e.full_name }}</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Loại nghỉ</label>
                <select v-model="form.leave_type" class="form-input">
                  <option v-for="(label, key) in leaveTypeLabels" :key="key" :value="key">{{ label }}</option>
                </select>
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">Từ ngày <span style="color:red">*</span></label>
                  <input v-model="form.start_date" type="date" class="form-input" />
                </div>
                <div class="form-group">
                  <label class="form-label">Đến ngày <span style="color:red">*</span></label>
                  <input v-model="form.end_date" type="date" class="form-input" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Số ngày nghỉ</label>
                <input v-model.number="form.total_days" type="number" class="form-input" min="0.5" step="0.5" />
              </div>
              <div class="form-group">
                <label class="form-label">Lý do <span style="color:red">*</span></label>
                <textarea v-model="form.reason" class="form-input" rows="3" placeholder="Nhập lý do nghỉ..."></textarea>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" @click="showForm = false">Hủy</button>
            <button class="btn-primary" @click="saveRequest">Gửi đơn</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Modal Từ chối -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showRejectModal" class="modal-overlay">
        <div class="modal-backdrop" @click="showRejectModal = false"></div>
        <div class="modal-container modal-sm">
          <div class="modal-header"><h3 class="modal-title">Từ chối đơn nghỉ</h3></div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Lý do từ chối</label>
              <textarea v-model="rejectReason" class="form-input" rows="3" placeholder="Nhập lý do..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" @click="showRejectModal = false">Hủy</button>
            <button class="btn-danger" @click="rejectRequest">Từ chối</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.material-icon { font-family: 'Material Icons'; font-size: 20px; vertical-align: middle; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.page-title { font-size: 1.3rem; font-weight: 600; color: #1a3a5c; }
.content-card { background: white; border-radius: 10px; padding: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
.filter-bar { display: flex; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; }
.filter-select { padding: 0.5rem 0.75rem; border: 1px solid #ddd; border-radius: 6px; font-size: 0.85rem; outline: none; }
.overflow-x-auto { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.table-th { text-align: left; padding: 0.7rem 0.75rem; background: #f8f9fa; color: #555; font-weight: 600; border-bottom: 2px solid #e9ecef; white-space: nowrap; }
.table-row:hover { background: #f8f9fb; }
.table-td { padding: 0.65rem 0.75rem; border-bottom: 1px solid #f0f0f0; color: #333; }

.type-tag { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 500; }
.lt-annual { background: #dbeafe; color: #1e40af; }
.lt-sick { background: #fef3c7; color: #92400e; }
.lt-maternity { background: #fce7f3; color: #9d174d; }
.lt-wedding { background: #ede9fe; color: #5b21b6; }
.lt-funeral { background: #f3f4f6; color: #374151; }
.lt-unpaid { background: #fee2e2; color: #991b1b; }
.lt-other { background: #e5e7eb; color: #4b5563; }

.status-badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.75rem; font-weight: 500; }
.st-pending { background: #fef3c7; color: #92400e; }
.st-approved { background: #d1fae5; color: #065f46; }
.st-rejected { background: #fee2e2; color: #991b1b; }
.st-cancelled { background: #e5e7eb; color: #4b5563; }

.action-btn { background: none; border: 1px solid #ddd; border-radius: 4px; padding: 4px 6px; cursor: pointer; color: #666; transition: all 0.15s; }
.action-btn .material-icon { font-size: 16px; }
.action-btn-approve:hover { color: #059669; border-color: #059669; background: #ecfdf5; }
.action-btn-reject:hover { color: #dc2626; border-color: #dc2626; background: #fef2f2; }
.action-btn-delete:hover { color: #dc2626; border-color: #dc2626; }

.pagination-bar { display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid #f0f0f0; }
.pagination-center { display: flex; gap: 4px; align-items: center; }
.pagination-btn { padding: 0.3rem 0.6rem; border: 1px solid #ddd; border-radius: 4px; background: white; cursor: pointer; font-size: 0.8rem; color: #555; }
.pagination-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pagination-btn-active { background: #1a3a5c !important; color: white !important; border-color: #1a3a5c !important; }
.pagination-dots { padding: 0.3rem; color: #999; }
.pagination-info { font-size: 0.8rem; color: #888; }

.btn-primary { padding: 0.5rem 1rem; background: #1a3a5c; color: white; border: none; border-radius: 6px; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 4px; }
.btn-primary:hover { background: #15304d; }
.btn-cancel { padding: 0.5rem 1rem; background: #f3f4f6; color: #555; border: 1px solid #ddd; border-radius: 6px; font-size: 0.85rem; cursor: pointer; }
.btn-danger { padding: 0.5rem 1rem; background: #dc2626; color: white; border: none; border-radius: 6px; font-size: 0.85rem; cursor: pointer; }
.btn-danger:hover { background: #b91c1c; }

.modal-overlay { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; }
.modal-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.5); }
.modal-container { position: relative; background: white; border-radius: 12px; max-height: 90vh; display: flex; flex-direction: column; width: 90%; }
.modal-sm { max-width: 24rem; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; border-bottom: 1px solid #e9ecef; }
.modal-title { font-size: 1.1rem; font-weight: 600; color: #1a3a5c; }
.modal-close { background: none; border: none; cursor: pointer; color: #999; padding: 4px; }
.modal-body { padding: 1.25rem; overflow-y: auto; }
.modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; padding: 1rem 1.25rem; border-top: 1px solid #e9ecef; }

.form-stack { display: flex; flex-direction: column; gap: 1rem; }
.form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.form-group { display: flex; flex-direction: column; gap: 0.3rem; }
.form-label { font-size: 0.8rem; font-weight: 500; color: #555; }
.form-input { padding: 0.5rem 0.75rem; border: 1px solid #ddd; border-radius: 6px; font-size: 0.85rem; outline: none; }
.form-input:focus { border-color: #1a3a5c; }
textarea.form-input { resize: vertical; }

.modal-enter-active, .modal-leave-active { transition: opacity 0.2s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
