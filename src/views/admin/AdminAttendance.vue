<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import api from '../../api'
import { adminDepartments as departments, ensureAdminDepartments } from '../../composables/useOrgLists'

interface Employee {
  id: number
  full_name: string
  employee_code: string
  department_id: number | null
}

interface AttendanceRecord {
  id: number
  employee_id: number
  date: string
  check_in: string | null
  check_out: string | null
  status: string
  work_hours: number | null
  overtime_hours: number | null
  notes: string | null
  employee?: Employee
}

interface SummaryRecord {
  employee_id: number
  full_name: string
  employee_code: string
  department: { id: number; name: string } | null
  total_days: number
  present: number
  late: number
  absent: number
  on_leave: number
  half_day: number
  business_trip: number
  remote: number
  total_work_hours: number
  total_overtime: number
}

const activeView = ref<'daily' | 'summary'>('daily')
const loading = ref(false)

// Daily view
const attendanceList = ref<AttendanceRecord[]>([])
const filterDate = ref(new Date().toISOString().split('T')[0])
const filterDepartment = ref('')
const filterStatus = ref('')
const currentPage = ref(1)
const totalPages = ref(1)
const totalItems = ref(0)
const perPage = ref(25)

// Summary view
const summaryList = ref<SummaryRecord[]>([])
const summaryMonth = ref(String(new Date().getMonth() + 1))
const summaryYear = ref(String(new Date().getFullYear()))
const summaryDept = ref('')

// Form chấm công
const showForm = ref(false)
const employees = ref<Employee[]>([])
const form = ref({
  employee_id: '' as string | number,
  date: new Date().toISOString().split('T')[0],
  check_in: '08:00',
  check_out: '17:00',
  status: 'present',
  overtime_hours: 0,
  notes: '',
})

const statusLabels: Record<string, string> = {
  present: 'Đi làm',
  absent: 'Vắng',
  late: 'Đi muộn',
  half_day: 'Nửa ngày',
  on_leave: 'Nghỉ phép',
  business_trip: 'Công tác',
  remote: 'Từ xa',
}

const statusClasses: Record<string, string> = {
  present: 'st-present',
  absent: 'st-absent',
  late: 'st-late',
  half_day: 'st-half',
  on_leave: 'st-leave',
  business_trip: 'st-trip',
  remote: 'st-remote',
}

async function fetchAttendance() {
  loading.value = true
  try {
    const params: any = { page: currentPage.value, limit: perPage.value }
    if (filterDate.value) params.date = filterDate.value
    if (filterDepartment.value) params.department_id = filterDepartment.value
    if (filterStatus.value) params.status = filterStatus.value

    const { data } = await api.get('/admin/attendance', { params })
    attendanceList.value = data.data
    totalPages.value = data.meta.totalPages
    totalItems.value = data.meta.total
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

async function fetchSummary() {
  loading.value = true
  try {
    const params: any = { month: summaryMonth.value, year: summaryYear.value }
    if (summaryDept.value) params.department_id = summaryDept.value
    const { data } = await api.get('/admin/attendance/summary', { params })
    summaryList.value = data.data
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
  form.value = {
    employee_id: '',
    date: filterDate.value || new Date().toISOString().split('T')[0],
    check_in: '08:00',
    check_out: '17:00',
    status: 'present',
    overtime_hours: 0,
    notes: '',
  }
  showForm.value = true
}

async function saveAttendance() {
  if (!form.value.employee_id) return alert('Vui lòng chọn nhân viên')
  try {
    await api.post('/admin/attendance', form.value)
    showForm.value = false
    if (activeView.value === 'daily') fetchAttendance()
    else fetchSummary()
  } catch (e: any) {
    alert(e.response?.data?.message || 'Có lỗi xảy ra')
  }
}

async function deleteRecord(id: number) {
  if (!confirm('Xóa bản ghi chấm công này?')) return
  try {
    await api.delete(`/admin/attendance/${id}`)
    fetchAttendance()
  } catch (e: any) { alert(e.response?.data?.message || 'Có lỗi xảy ra') }
}

watch([filterDate, filterDepartment, filterStatus], () => { currentPage.value = 1; fetchAttendance() })
watch(currentPage, () => fetchAttendance())
watch([summaryMonth, summaryYear, summaryDept], () => fetchSummary())
watch(activeView, (v) => { if (v === 'daily') fetchAttendance(); else fetchSummary() })

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

onMounted(() => {
  fetchAttendance()
  void ensureAdminDepartments()
  fetchEmployees()
})
</script>

<template>
  <div class="page-header">
    <h2 class="page-title">Chấm công</h2>
    <div style="display:flex;gap:0.5rem">
      <div class="view-toggle">
        <button class="toggle-btn" :class="{ active: activeView === 'daily' }" @click="activeView = 'daily'">Theo ngày</button>
        <button class="toggle-btn" :class="{ active: activeView === 'summary' }" @click="activeView = 'summary'">Tổng hợp tháng</button>
      </div>
      <button class="btn-primary" @click="openForm"><span class="material-icon">add</span> Chấm công</button>
    </div>
  </div>

  <!-- DAILY VIEW -->
  <div v-if="activeView === 'daily'" class="content-card">
    <div class="filter-bar">
      <input v-model="filterDate" type="date" class="filter-select" />
      <select v-model="filterDepartment" class="filter-select">
        <option value="">Tất cả phòng ban</option>
        <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option>
      </select>
      <select v-model="filterStatus" class="filter-select">
        <option value="">Tất cả trạng thái</option>
        <option v-for="(label, key) in statusLabels" :key="key" :value="key">{{ label }}</option>
      </select>
    </div>

    <div class="overflow-x-auto">
      <table class="data-table">
        <thead><tr>
          <th class="table-th">Mã NV</th>
          <th class="table-th">Họ tên</th>
          <th class="table-th">Ngày</th>
          <th class="table-th">Giờ vào</th>
          <th class="table-th">Giờ ra</th>
          <th class="table-th">Số giờ</th>
          <th class="table-th">Tăng ca</th>
          <th class="table-th">Trạng thái</th>
          <th class="table-th">Ghi chú</th>
          <th class="table-th" style="width:60px"></th>
        </tr></thead>
        <tbody>
          <tr v-if="loading"><td colspan="10" class="table-td" style="text-align:center;padding:2rem">Đang tải...</td></tr>
          <tr v-else-if="attendanceList.length === 0"><td colspan="10" class="table-td" style="text-align:center;padding:2rem;color:#999">Không có dữ liệu</td></tr>
          <tr v-for="a in attendanceList" :key="a.id" class="table-row">
            <td class="table-td"><strong>{{ a.employee?.employee_code }}</strong></td>
            <td class="table-td">{{ a.employee?.full_name }}</td>
            <td class="table-td">{{ new Date(a.date).toLocaleDateString('vi-VN') }}</td>
            <td class="table-td">{{ a.check_in || '—' }}</td>
            <td class="table-td">{{ a.check_out || '—' }}</td>
            <td class="table-td">{{ a.work_hours != null ? Number(a.work_hours).toFixed(1) : '—' }}</td>
            <td class="table-td">{{ a.overtime_hours ? Number(a.overtime_hours).toFixed(1) : '0' }}</td>
            <td class="table-td"><span class="status-badge" :class="statusClasses[a.status]">{{ statusLabels[a.status] || a.status }}</span></td>
            <td class="table-td" style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ a.notes || '' }}</td>
            <td class="table-td"><button class="action-btn action-btn-delete" @click="deleteRecord(a.id)"><span class="material-icon">delete</span></button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="totalPages > 1" class="pagination-bar">
      <div class="pagination-left"><span class="pagination-info">{{ totalItems }} bản ghi</span></div>
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

  <!-- SUMMARY VIEW -->
  <div v-else class="content-card">
    <div class="filter-bar">
      <select v-model="summaryMonth" class="filter-select">
        <option v-for="m in 12" :key="m" :value="String(m)">Tháng {{ m }}</option>
      </select>
      <select v-model="summaryYear" class="filter-select">
        <option v-for="y in [2024, 2025, 2026, 2027]" :key="y" :value="String(y)">Năm {{ y }}</option>
      </select>
      <select v-model="summaryDept" class="filter-select">
        <option value="">Tất cả phòng ban</option>
        <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option>
      </select>
    </div>

    <div class="overflow-x-auto">
      <table class="data-table">
        <thead><tr>
          <th class="table-th">Mã NV</th>
          <th class="table-th">Họ tên</th>
          <th class="table-th">Phòng ban</th>
          <th class="table-th" style="text-align:center">Đi làm</th>
          <th class="table-th" style="text-align:center">Đi muộn</th>
          <th class="table-th" style="text-align:center">Vắng</th>
          <th class="table-th" style="text-align:center">Nghỉ phép</th>
          <th class="table-th" style="text-align:center">Công tác</th>
          <th class="table-th" style="text-align:center">Từ xa</th>
          <th class="table-th" style="text-align:center">Tổng giờ</th>
          <th class="table-th" style="text-align:center">Tăng ca</th>
        </tr></thead>
        <tbody>
          <tr v-if="loading"><td colspan="11" class="table-td" style="text-align:center;padding:2rem">Đang tải...</td></tr>
          <tr v-else-if="summaryList.length === 0"><td colspan="11" class="table-td" style="text-align:center;padding:2rem;color:#999">Không có dữ liệu</td></tr>
          <tr v-for="s in summaryList" :key="s.employee_id" class="table-row">
            <td class="table-td"><strong>{{ s.employee_code }}</strong></td>
            <td class="table-td">{{ s.full_name }}</td>
            <td class="table-td">{{ s.department?.name || '—' }}</td>
            <td class="table-td" style="text-align:center"><span class="count-badge count-present">{{ s.present }}</span></td>
            <td class="table-td" style="text-align:center"><span v-if="s.late" class="count-badge count-late">{{ s.late }}</span><span v-else>0</span></td>
            <td class="table-td" style="text-align:center"><span v-if="s.absent" class="count-badge count-absent">{{ s.absent }}</span><span v-else>0</span></td>
            <td class="table-td" style="text-align:center">{{ s.on_leave }}</td>
            <td class="table-td" style="text-align:center">{{ s.business_trip }}</td>
            <td class="table-td" style="text-align:center">{{ s.remote }}</td>
            <td class="table-td" style="text-align:center;font-weight:600">{{ s.total_work_hours.toFixed(1) }}</td>
            <td class="table-td" style="text-align:center">{{ s.total_overtime.toFixed(1) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Modal Chấm công -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showForm" class="modal-overlay">
        <div class="modal-backdrop" @click="showForm = false"></div>
        <div class="modal-container" style="max-width:32rem">
          <div class="modal-header">
            <h3 class="modal-title">Chấm công</h3>
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
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">Ngày</label>
                  <input v-model="form.date" type="date" class="form-input" />
                </div>
                <div class="form-group">
                  <label class="form-label">Trạng thái</label>
                  <select v-model="form.status" class="form-input">
                    <option v-for="(label, key) in statusLabels" :key="key" :value="key">{{ label }}</option>
                  </select>
                </div>
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">Giờ vào</label>
                  <input v-model="form.check_in" type="time" class="form-input" />
                </div>
                <div class="form-group">
                  <label class="form-label">Giờ ra</label>
                  <input v-model="form.check_out" type="time" class="form-input" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Tăng ca (giờ)</label>
                <input v-model.number="form.overtime_hours" type="number" class="form-input" min="0" step="0.5" />
              </div>
              <div class="form-group">
                <label class="form-label">Ghi chú</label>
                <input v-model="form.notes" class="form-input" placeholder="Ghi chú..." />
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" @click="showForm = false">Hủy</button>
            <button class="btn-primary" @click="saveAttendance">Lưu</button>
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

.view-toggle { display: flex; border: 1px solid #ddd; border-radius: 6px; overflow: hidden; }
.toggle-btn { padding: 0.5rem 1rem; border: none; background: white; font-size: 0.85rem; cursor: pointer; color: #666; }
.toggle-btn.active { background: #1a3a5c; color: white; }

.status-badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.75rem; font-weight: 500; }
.st-present { background: #d1fae5; color: #065f46; }
.st-absent { background: #fee2e2; color: #991b1b; }
.st-late { background: #fef3c7; color: #92400e; }
.st-half { background: #e0e7ff; color: #3730a3; }
.st-leave { background: #dbeafe; color: #1e40af; }
.st-trip { background: #ede9fe; color: #5b21b6; }
.st-remote { background: #ccfbf1; color: #115e59; }

.count-badge { display: inline-block; min-width: 24px; text-align: center; padding: 2px 6px; border-radius: 10px; font-size: 0.8rem; font-weight: 600; }
.count-present { background: #d1fae5; color: #065f46; }
.count-late { background: #fef3c7; color: #92400e; }
.count-absent { background: #fee2e2; color: #991b1b; }

.action-btn { background: none; border: 1px solid #ddd; border-radius: 4px; padding: 4px 6px; cursor: pointer; color: #666; }
.action-btn-delete:hover { color: #dc2626; border-color: #dc2626; }
.action-btn .material-icon { font-size: 16px; }

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

.modal-overlay { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; }
.modal-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.5); }
.modal-container { position: relative; background: white; border-radius: 12px; max-height: 90vh; display: flex; flex-direction: column; width: 90%; }
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

.modal-enter-active, .modal-leave-active { transition: opacity 0.2s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
