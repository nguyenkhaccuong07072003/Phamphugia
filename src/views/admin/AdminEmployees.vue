<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import api from '../../api'
import { adminDepartments as departments, ensureAdminDepartments } from '../../composables/useOrgLists'

interface Position {
  id: number
  name: string
  code: string
  level: number
}

interface Department {
  id: number
  name: string
}

interface Employee {
  id: number
  employee_code: string
  full_name: string
  date_of_birth: string | null
  gender: string | null
  id_card_number: string | null
  id_card_date: string | null
  id_card_place: string | null
  phone: string | null
  email: string | null
  address: string | null
  permanent_address: string | null
  avatar_url: string | null
  department_id: number | null
  position_id: number | null
  hire_date: string | null
  termination_date: string | null
  status: string
  bank_account: string | null
  bank_name: string | null
  tax_code: string | null
  social_insurance_number: string | null
  notes: string | null
  department?: Department
  position?: Position
}

const employees = ref<Employee[]>([])
const positions = ref<Position[]>([])
const loading = ref(false)
const showForm = ref(false)
const editingId = ref<number | null>(null)
const deleteConfirmId = ref<number | null>(null)
const showDetail = ref(false)
const detailEmployee = ref<any>(null)

// Tìm kiếm & lọc
const searchQuery = ref('')
const filterDepartment = ref('')
const filterStatus = ref('')

// Phân trang
const currentPage = ref(1)
const totalPages = ref(1)
const totalItems = ref(0)
const perPage = ref(10)
const perPageOptions = [10, 15, 25, 50]

// Thống kê
const stats = ref({ total: 0, active: 0, probation: 0, on_leave: 0, terminated: 0 })

// Form
const defaultForm = {
  employee_code: '',
  full_name: '',
  date_of_birth: '',
  gender: '',
  id_card_number: '',
  id_card_date: '',
  id_card_place: '',
  phone: '',
  email: '',
  address: '',
  permanent_address: '',
  department_id: '' as string | number,
  position_id: '' as string | number,
  hire_date: '',
  termination_date: '',
  status: 'active',
  bank_account: '',
  bank_name: '',
  tax_code: '',
  social_insurance_number: '',
  notes: '',
}
const form = ref({ ...defaultForm })
const activeTab = ref('info')

async function fetchEmployees() {
  loading.value = true
  try {
    const params: any = { page: currentPage.value, limit: perPage.value }
    if (searchQuery.value) params.search = searchQuery.value
    if (filterDepartment.value) params.department_id = filterDepartment.value
    if (filterStatus.value) params.status = filterStatus.value

    const { data } = await api.get('/admin/employees', { params })
    employees.value = data.data
    totalPages.value = data.meta.totalPages
    totalItems.value = data.meta.total
  } catch (e) {
    console.error('Failed to fetch employees:', e)
  } finally {
    loading.value = false
  }
}

async function fetchPositions() {
  try {
    const { data } = await api.get('/admin/positions', { params: { all: 'true' } })
    positions.value = data.data
  } catch (e) { console.error('Failed to fetch positions:', e) }
}

async function fetchStats() {
  try {
    const { data } = await api.get('/admin/employees/stats/overview')
    stats.value = data.data
  } catch (e) { console.error('Failed to fetch stats:', e) }
}

function openCreate() {
  editingId.value = null
  form.value = { ...defaultForm }
  activeTab.value = 'info'
  showForm.value = true
}

function openEdit(emp: Employee) {
  editingId.value = emp.id
  form.value = {
    employee_code: emp.employee_code,
    full_name: emp.full_name,
    date_of_birth: emp.date_of_birth || '',
    gender: emp.gender || '',
    id_card_number: emp.id_card_number || '',
    id_card_date: emp.id_card_date || '',
    id_card_place: emp.id_card_place || '',
    phone: emp.phone || '',
    email: emp.email || '',
    address: emp.address || '',
    permanent_address: emp.permanent_address || '',
    department_id: emp.department_id || '',
    position_id: emp.position_id || '',
    hire_date: emp.hire_date || '',
    termination_date: emp.termination_date || '',
    status: emp.status,
    bank_account: emp.bank_account || '',
    bank_name: emp.bank_name || '',
    tax_code: emp.tax_code || '',
    social_insurance_number: emp.social_insurance_number || '',
    notes: emp.notes || '',
  }
  activeTab.value = 'info'
  showForm.value = true
}

async function openDetail(emp: Employee) {
  try {
    const { data } = await api.get(`/admin/employees/${emp.id}`)
    detailEmployee.value = data.data
    showDetail.value = true
  } catch (e) { console.error('Failed to fetch employee detail:', e) }
}

async function saveEmployee() {
  try {
    const payload: any = { ...form.value }
    if (payload.department_id === '') payload.department_id = null
    if (payload.position_id === '') payload.position_id = null

    if (editingId.value) {
      await api.put(`/admin/employees/${editingId.value}`, payload)
    } else {
      await api.post('/admin/employees', payload)
    }
    showForm.value = false
    fetchEmployees()
    fetchStats()
  } catch (e: any) {
    alert(e.response?.data?.message || 'Có lỗi xảy ra')
  }
}

async function deleteEmployee() {
  if (!deleteConfirmId.value) return
  try {
    await api.delete(`/admin/employees/${deleteConfirmId.value}`)
    deleteConfirmId.value = null
    fetchEmployees()
    fetchStats()
  } catch (e: any) {
    alert(e.response?.data?.message || 'Có lỗi xảy ra')
  }
}

function goToPage(page: number) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

function getStatusLabel(status: string) {
  const map: Record<string, string> = {
    active: 'Đang làm việc',
    probation: 'Thử việc',
    on_leave: 'Nghỉ phép',
    terminated: 'Đã nghỉ việc',
  }
  return map[status] || status
}

function getStatusClass(status: string) {
  const map: Record<string, string> = {
    active: 'status-active',
    probation: 'status-probation',
    on_leave: 'status-leave',
    terminated: 'status-terminated',
  }
  return map[status] || ''
}

function getGenderLabel(gender: string | null) {
  if (!gender) return ''
  const map: Record<string, string> = { male: 'Nam', female: 'Nữ', other: 'Khác' }
  return map[gender] || gender
}

function formatDate(d: string | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('vi-VN')
}

const paginationPages = computed(() => {
  const pages: (number | string)[] = []
  const total = totalPages.value
  const cur = currentPage.value
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i)
  } else {
    pages.push(1)
    if (cur > 3) pages.push('...')
    for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i)
    if (cur < total - 2) pages.push('...')
    pages.push(total)
  }
  return pages
})

// Debounce tìm kiếm
let searchTimeout: ReturnType<typeof setTimeout>
watch(searchQuery, () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => { currentPage.value = 1; fetchEmployees() }, 300)
})

watch([filterDepartment, filterStatus, perPage], () => {
  currentPage.value = 1
  fetchEmployees()
})

watch(currentPage, () => fetchEmployees())

onMounted(() => {
  fetchEmployees()
  void ensureAdminDepartments()
  fetchPositions()
  fetchStats()
})
</script>

<template>
  <!-- Stats Cards -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-icon stat-icon-total"><span class="material-icon">groups</span></div>
      <div class="stat-info"><div class="stat-number">{{ stats.total }}</div><div class="stat-label">Tổng nhân viên</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon stat-icon-active"><span class="material-icon">person</span></div>
      <div class="stat-info"><div class="stat-number">{{ stats.active }}</div><div class="stat-label">Đang làm việc</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon stat-icon-probation"><span class="material-icon">hourglass_empty</span></div>
      <div class="stat-info"><div class="stat-number">{{ stats.probation }}</div><div class="stat-label">Thử việc</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon stat-icon-terminated"><span class="material-icon">person_off</span></div>
      <div class="stat-info"><div class="stat-number">{{ stats.terminated }}</div><div class="stat-label">Đã nghỉ việc</div></div>
    </div>
  </div>

  <!-- Header -->
  <div class="page-header">
    <h2 class="page-title">Quản lý nhân viên</h2>
    <button class="btn-primary" @click="openCreate"><span class="material-icon">add</span> Thêm nhân viên</button>
  </div>

  <!-- Bộ lọc -->
  <div class="content-card">
    <div class="filter-bar">
      <div class="search-wrapper">
        <span class="material-icon search-icon">search</span>
        <input v-model="searchQuery" class="search-input" placeholder="Tìm theo tên, mã NV, SĐT, email..." />
      </div>
      <select v-model="filterDepartment" class="filter-select">
        <option value="">Tất cả phòng ban</option>
        <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option>
      </select>
      <select v-model="filterStatus" class="filter-select">
        <option value="">Tất cả trạng thái</option>
        <option value="active">Đang làm việc</option>
        <option value="probation">Thử việc</option>
        <option value="on_leave">Nghỉ phép</option>
        <option value="terminated">Đã nghỉ việc</option>
      </select>
    </div>

    <!-- Bảng -->
    <div class="overflow-x-auto">
      <table class="data-table">
        <thead>
          <tr>
            <th class="table-th">Mã NV</th>
            <th class="table-th">Họ tên</th>
            <th class="table-th">Phòng ban</th>
            <th class="table-th">Chức vụ</th>
            <th class="table-th">SĐT</th>
            <th class="table-th">Ngày vào</th>
            <th class="table-th">Trạng thái</th>
            <th class="table-th" style="width: 140px">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="8" class="table-td" style="text-align:center;padding:2rem">Đang tải...</td>
          </tr>
          <tr v-else-if="employees.length === 0">
            <td colspan="8" class="table-td" style="text-align:center;padding:2rem;color:#999">Không có nhân viên nào</td>
          </tr>
          <tr v-for="emp in employees" :key="emp.id" class="table-row">
            <td class="table-td"><strong>{{ emp.employee_code }}</strong></td>
            <td class="table-td">
              <div style="cursor:pointer;color:#1a3a5c;font-weight:500" @click="openDetail(emp)">{{ emp.full_name }}</div>
            </td>
            <td class="table-td">{{ emp.department?.name || '—' }}</td>
            <td class="table-td">{{ emp.position?.name || '—' }}</td>
            <td class="table-td">{{ emp.phone || '—' }}</td>
            <td class="table-td">{{ formatDate(emp.hire_date) }}</td>
            <td class="table-td"><span class="status-badge" :class="getStatusClass(emp.status)">{{ getStatusLabel(emp.status) }}</span></td>
            <td class="table-td">
              <div style="display:flex;gap:4px">
                <button class="action-btn action-btn-view" title="Xem chi tiết" @click="openDetail(emp)"><span class="material-icon">visibility</span></button>
                <button class="action-btn action-btn-edit" title="Sửa" @click="openEdit(emp)"><span class="material-icon">edit</span></button>
                <button class="action-btn action-btn-delete" title="Xóa" @click="deleteConfirmId = emp.id"><span class="material-icon">delete</span></button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Phân trang -->
    <div v-if="totalPages > 0" class="pagination-bar">
      <div class="pagination-left">
        <select v-model="perPage" class="perpage-select">
          <option v-for="opt in perPageOptions" :key="opt" :value="opt">{{ opt }} / trang</option>
        </select>
      </div>
      <div class="pagination-center">
        <button class="pagination-btn" :disabled="currentPage <= 1" @click="goToPage(currentPage - 1)">‹</button>
        <template v-for="p in paginationPages" :key="p">
          <span v-if="p === '...'" class="pagination-dots">...</span>
          <button v-else class="pagination-btn" :class="{ 'pagination-btn-active': p === currentPage }" @click="goToPage(p as number)">{{ p }}</button>
        </template>
        <button class="pagination-btn" :disabled="currentPage >= totalPages" @click="goToPage(currentPage + 1)">›</button>
      </div>
      <div class="pagination-right">
        <span class="pagination-info">{{ totalItems }} nhân viên</span>
      </div>
    </div>
  </div>

  <!-- Modal Thêm/Sửa Nhân viên -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showForm" class="modal-overlay">
        <div class="modal-backdrop" @click="showForm = false"></div>
        <div class="modal-container modal-lg">
          <div class="modal-header">
            <h3 class="modal-title">{{ editingId ? 'Sửa nhân viên' : 'Thêm nhân viên mới' }}</h3>
            <button class="modal-close" @click="showForm = false"><span class="material-icon">close</span></button>
          </div>

          <!-- Tabs -->
          <div class="modal-tabs">
            <button class="modal-tab" :class="{ active: activeTab === 'info' }" @click="activeTab = 'info'">Thông tin cá nhân</button>
            <button class="modal-tab" :class="{ active: activeTab === 'work' }" @click="activeTab = 'work'">Công việc</button>
            <button class="modal-tab" :class="{ active: activeTab === 'bank' }" @click="activeTab = 'bank'">Ngân hàng & Bảo hiểm</button>
          </div>

          <div class="modal-body">
            <!-- Tab: Thông tin cá nhân -->
            <div v-show="activeTab === 'info'">
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">Mã nhân viên <span style="color:red">*</span></label>
                  <input v-model="form.employee_code" class="form-input" placeholder="VD: NV001" :disabled="!!editingId" />
                </div>
                <div class="form-group">
                  <label class="form-label">Họ và tên <span style="color:red">*</span></label>
                  <input v-model="form.full_name" class="form-input" placeholder="Nguyễn Văn A" />
                </div>
                <div class="form-group">
                  <label class="form-label">Ngày sinh</label>
                  <input v-model="form.date_of_birth" type="date" class="form-input" />
                </div>
                <div class="form-group">
                  <label class="form-label">Giới tính</label>
                  <select v-model="form.gender" class="form-input">
                    <option value="">-- Chọn --</option>
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                    <option value="other">Khác</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Số CCCD/CMND</label>
                  <input v-model="form.id_card_number" class="form-input" />
                </div>
                <div class="form-group">
                  <label class="form-label">Ngày cấp</label>
                  <input v-model="form.id_card_date" type="date" class="form-input" />
                </div>
                <div class="form-group form-group-full">
                  <label class="form-label">Nơi cấp</label>
                  <input v-model="form.id_card_place" class="form-input" />
                </div>
                <div class="form-group">
                  <label class="form-label">Số điện thoại</label>
                  <input v-model="form.phone" class="form-input" />
                </div>
                <div class="form-group">
                  <label class="form-label">Email</label>
                  <input v-model="form.email" type="email" class="form-input" />
                </div>
                <div class="form-group form-group-full">
                  <label class="form-label">Địa chỉ hiện tại</label>
                  <input v-model="form.address" class="form-input" />
                </div>
                <div class="form-group form-group-full">
                  <label class="form-label">Địa chỉ thường trú</label>
                  <input v-model="form.permanent_address" class="form-input" />
                </div>
              </div>
            </div>

            <!-- Tab: Công việc -->
            <div v-show="activeTab === 'work'">
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">Phòng ban</label>
                  <select v-model="form.department_id" class="form-input">
                    <option value="">-- Chọn phòng ban --</option>
                    <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Chức vụ</label>
                  <select v-model="form.position_id" class="form-input">
                    <option value="">-- Chọn chức vụ --</option>
                    <option v-for="p in positions" :key="p.id" :value="p.id">{{ p.name }}</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Ngày vào làm</label>
                  <input v-model="form.hire_date" type="date" class="form-input" />
                </div>
                <div class="form-group">
                  <label class="form-label">Trạng thái</label>
                  <select v-model="form.status" class="form-input">
                    <option value="active">Đang làm việc</option>
                    <option value="probation">Thử việc</option>
                    <option value="on_leave">Nghỉ phép</option>
                    <option value="terminated">Đã nghỉ việc</option>
                  </select>
                </div>
                <div v-if="form.status === 'terminated'" class="form-group">
                  <label class="form-label">Ngày nghỉ việc</label>
                  <input v-model="form.termination_date" type="date" class="form-input" />
                </div>
                <div class="form-group form-group-full">
                  <label class="form-label">Ghi chú</label>
                  <textarea v-model="form.notes" class="form-input" rows="3"></textarea>
                </div>
              </div>
            </div>

            <!-- Tab: Ngân hàng & Bảo hiểm -->
            <div v-show="activeTab === 'bank'">
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">Số tài khoản ngân hàng</label>
                  <input v-model="form.bank_account" class="form-input" />
                </div>
                <div class="form-group">
                  <label class="form-label">Tên ngân hàng</label>
                  <input v-model="form.bank_name" class="form-input" />
                </div>
                <div class="form-group">
                  <label class="form-label">Mã số thuế</label>
                  <input v-model="form.tax_code" class="form-input" />
                </div>
                <div class="form-group">
                  <label class="form-label">Số sổ BHXH</label>
                  <input v-model="form.social_insurance_number" class="form-input" />
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-cancel" @click="showForm = false">Hủy</button>
            <button class="btn-primary" @click="saveEmployee">{{ editingId ? 'Cập nhật' : 'Tạo mới' }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Modal Chi tiết nhân viên -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showDetail && detailEmployee" class="modal-overlay">
        <div class="modal-backdrop" @click="showDetail = false"></div>
        <div class="modal-container modal-lg">
          <div class="modal-header">
            <h3 class="modal-title">Hồ sơ nhân viên: {{ detailEmployee.full_name }}</h3>
            <button class="modal-close" @click="showDetail = false"><span class="material-icon">close</span></button>
          </div>
          <div class="modal-body">
            <div class="detail-grid">
              <div class="detail-section">
                <h4 class="detail-section-title">Thông tin cá nhân</h4>
                <div class="detail-row"><span class="detail-label">Mã NV:</span><span>{{ detailEmployee.employee_code }}</span></div>
                <div class="detail-row"><span class="detail-label">Họ tên:</span><span>{{ detailEmployee.full_name }}</span></div>
                <div class="detail-row"><span class="detail-label">Ngày sinh:</span><span>{{ formatDate(detailEmployee.date_of_birth) }}</span></div>
                <div class="detail-row"><span class="detail-label">Giới tính:</span><span>{{ getGenderLabel(detailEmployee.gender) }}</span></div>
                <div class="detail-row"><span class="detail-label">CCCD:</span><span>{{ detailEmployee.id_card_number || '—' }}</span></div>
                <div class="detail-row"><span class="detail-label">SĐT:</span><span>{{ detailEmployee.phone || '—' }}</span></div>
                <div class="detail-row"><span class="detail-label">Email:</span><span>{{ detailEmployee.email || '—' }}</span></div>
                <div class="detail-row"><span class="detail-label">Địa chỉ:</span><span>{{ detailEmployee.address || '—' }}</span></div>
              </div>
              <div class="detail-section">
                <h4 class="detail-section-title">Công việc</h4>
                <div class="detail-row"><span class="detail-label">Phòng ban:</span><span>{{ detailEmployee.department?.name || '—' }}</span></div>
                <div class="detail-row"><span class="detail-label">Chức vụ:</span><span>{{ detailEmployee.position?.name || '—' }}</span></div>
                <div class="detail-row"><span class="detail-label">Ngày vào:</span><span>{{ formatDate(detailEmployee.hire_date) }}</span></div>
                <div class="detail-row"><span class="detail-label">Trạng thái:</span><span class="status-badge" :class="getStatusClass(detailEmployee.status)">{{ getStatusLabel(detailEmployee.status) }}</span></div>
                <div class="detail-row"><span class="detail-label">Ngân hàng:</span><span>{{ detailEmployee.bank_account ? `${detailEmployee.bank_account} - ${detailEmployee.bank_name}` : '—' }}</span></div>
                <div class="detail-row"><span class="detail-label">MST:</span><span>{{ detailEmployee.tax_code || '—' }}</span></div>
                <div class="detail-row"><span class="detail-label">Số sổ BHXH:</span><span>{{ detailEmployee.social_insurance_number || '—' }}</span></div>
              </div>
            </div>

            <!-- Hợp đồng -->
            <div v-if="detailEmployee.contracts?.length" class="detail-section" style="margin-top:1.5rem">
              <h4 class="detail-section-title">Hợp đồng lao động</h4>
              <table class="data-table">
                <thead><tr>
                  <th class="table-th">Số HĐ</th>
                  <th class="table-th">Loại</th>
                  <th class="table-th">Từ ngày</th>
                  <th class="table-th">Đến ngày</th>
                  <th class="table-th">Lương CB</th>
                  <th class="table-th">Trạng thái</th>
                </tr></thead>
                <tbody>
                  <tr v-for="c in detailEmployee.contracts" :key="c.id" class="table-row">
                    <td class="table-td">{{ c.contract_number }}</td>
                    <td class="table-td">{{ { probation: 'Thử việc', fixed_term: 'Có thời hạn', indefinite: 'Không thời hạn' }[c.contract_type as string] }}</td>
                    <td class="table-td">{{ formatDate(c.start_date) }}</td>
                    <td class="table-td">{{ c.end_date ? formatDate(c.end_date) : 'Không thời hạn' }}</td>
                    <td class="table-td">{{ Number(c.base_salary).toLocaleString('vi-VN') }}đ</td>
                    <td class="table-td"><span class="status-badge" :class="c.status === 'active' ? 'status-active' : 'status-terminated'">{{ c.status === 'active' ? 'Hiệu lực' : c.status === 'expired' ? 'Hết hạn' : 'Đã chấm dứt' }}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" @click="showDetail = false">Đóng</button>
            <button class="btn-primary" @click="showDetail = false; openEdit(detailEmployee)">Chỉnh sửa</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Modal Xác nhận xóa -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="deleteConfirmId" class="modal-overlay">
        <div class="modal-backdrop" @click="deleteConfirmId = null"></div>
        <div class="modal-container modal-sm">
          <div class="modal-header"><h3 class="modal-title">Xác nhận xóa</h3></div>
          <div class="modal-body"><p>Bạn có chắc chắn muốn xóa nhân viên này? Hành động này không thể hoàn tác.</p></div>
          <div class="modal-footer">
            <button class="btn-cancel" @click="deleteConfirmId = null">Hủy</button>
            <button class="btn-danger" @click="deleteEmployee">Xóa</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.material-icon { font-family: 'Material Icons'; font-size: 20px; vertical-align: middle; }

/* Stats */
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
.stat-card { background: white; border-radius: 10px; padding: 1.25rem; display: flex; align-items: center; gap: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
.stat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; }
.stat-icon .material-icon { font-size: 24px; }
.stat-icon-total { background: linear-gradient(135deg, #1a3a5c, #2d5a8e); }
.stat-icon-active { background: linear-gradient(135deg, #10b981, #059669); }
.stat-icon-probation { background: linear-gradient(135deg, #f59e0b, #d97706); }
.stat-icon-terminated { background: linear-gradient(135deg, #ef4444, #dc2626); }
.stat-number { font-size: 1.5rem; font-weight: 700; color: #1a3a5c; }
.stat-label { font-size: 0.8rem; color: #888; }

/* Page header */
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.page-title { font-size: 1.3rem; font-weight: 600; color: #1a3a5c; }

/* Content card & Filter */
.content-card { background: white; border-radius: 10px; padding: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
.filter-bar { display: flex; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; }
.search-wrapper { position: relative; flex: 1; min-width: 200px; }
.search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #aaa; font-size: 18px; }
.search-input { width: 100%; padding: 0.5rem 0.75rem 0.5rem 2.25rem; border: 1px solid #ddd; border-radius: 6px; font-size: 0.85rem; outline: none; }
.search-input:focus { border-color: #1a3a5c; }
.filter-select { padding: 0.5rem 0.75rem; border: 1px solid #ddd; border-radius: 6px; font-size: 0.85rem; outline: none; min-width: 160px; }

/* Table */
.overflow-x-auto { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.table-th { text-align: left; padding: 0.7rem 0.75rem; background: #f8f9fa; color: #555; font-weight: 600; border-bottom: 2px solid #e9ecef; white-space: nowrap; }
.table-row { transition: background 0.15s; }
.table-row:hover { background: #f8f9fb; }
.table-td { padding: 0.65rem 0.75rem; border-bottom: 1px solid #f0f0f0; color: #333; }

/* Status badge */
.status-badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.75rem; font-weight: 500; }
.status-active { background: #d1fae5; color: #065f46; }
.status-probation { background: #fef3c7; color: #92400e; }
.status-leave { background: #dbeafe; color: #1e40af; }
.status-terminated { background: #fee2e2; color: #991b1b; }

/* Action buttons */
.action-btn { background: none; border: 1px solid #ddd; border-radius: 4px; padding: 4px 6px; cursor: pointer; color: #666; transition: all 0.15s; }
.action-btn:hover { background: #f0f0f0; }
.action-btn-view:hover { color: #1a3a5c; border-color: #1a3a5c; }
.action-btn-edit:hover { color: #f0a500; border-color: #f0a500; }
.action-btn-delete:hover { color: #dc2626; border-color: #dc2626; }
.action-btn .material-icon { font-size: 16px; }

/* Pagination */
.pagination-bar { display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid #f0f0f0; }
.pagination-left, .pagination-right { min-width: 120px; }
.pagination-center { display: flex; gap: 4px; align-items: center; }
.perpage-select { padding: 0.3rem 0.5rem; border: 1px solid #ddd; border-radius: 4px; font-size: 0.8rem; }
.pagination-btn { padding: 0.3rem 0.6rem; border: 1px solid #ddd; border-radius: 4px; background: white; cursor: pointer; font-size: 0.8rem; color: #555; }
.pagination-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pagination-btn:hover:not(:disabled) { background: #f0f0f0; }
.pagination-btn-active { background: #1a3a5c !important; color: white !important; border-color: #1a3a5c !important; }
.pagination-dots { padding: 0.3rem; color: #999; }
.pagination-info { font-size: 0.8rem; color: #888; }

/* Buttons */
.btn-primary { padding: 0.5rem 1rem; background: #1a3a5c; color: white; border: none; border-radius: 6px; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 4px; }
.btn-primary:hover { background: #15304d; }
.btn-cancel { padding: 0.5rem 1rem; background: #f3f4f6; color: #555; border: 1px solid #ddd; border-radius: 6px; font-size: 0.85rem; cursor: pointer; }
.btn-danger { padding: 0.5rem 1rem; background: #dc2626; color: white; border: none; border-radius: 6px; font-size: 0.85rem; cursor: pointer; }
.btn-danger:hover { background: #b91c1c; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; }
.modal-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.5); }
.modal-container { position: relative; background: white; border-radius: 12px; max-height: 90vh; display: flex; flex-direction: column; width: 90%; }
.modal-lg { max-width: 56rem; }
.modal-sm { max-width: 24rem; }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; border-bottom: 1px solid #e9ecef; }
.modal-title { font-size: 1.1rem; font-weight: 600; color: #1a3a5c; }
.modal-close { background: none; border: none; cursor: pointer; color: #999; padding: 4px; }
.modal-body { padding: 1.25rem; overflow-y: auto; flex: 1; }
.modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; padding: 1rem 1.25rem; border-top: 1px solid #e9ecef; }

/* Modal tabs */
.modal-tabs { display: flex; border-bottom: 1px solid #e9ecef; padding: 0 1.25rem; }
.modal-tab { padding: 0.75rem 1rem; background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-size: 0.85rem; color: #888; font-weight: 500; }
.modal-tab:hover { color: #1a3a5c; }
.modal-tab.active { color: #1a3a5c; border-bottom-color: #1a3a5c; }

/* Form */
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.form-group { display: flex; flex-direction: column; gap: 0.3rem; }
.form-group-full { grid-column: 1 / -1; }
.form-label { font-size: 0.8rem; font-weight: 500; color: #555; }
.form-input { padding: 0.5rem 0.75rem; border: 1px solid #ddd; border-radius: 6px; font-size: 0.85rem; outline: none; }
.form-input:focus { border-color: #1a3a5c; }
.form-input:disabled { background: #f5f5f5; }
textarea.form-input { resize: vertical; }

/* Detail */
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
.detail-section-title { font-size: 0.95rem; font-weight: 600; color: #1a3a5c; margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid #e9ecef; }
.detail-row { display: flex; padding: 0.35rem 0; font-size: 0.85rem; }
.detail-label { width: 120px; color: #888; flex-shrink: 0; }

/* Transition */
.modal-enter-active, .modal-leave-active { transition: opacity 0.2s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }

@media (max-width: 768px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .form-grid { grid-template-columns: 1fr; }
  .detail-grid { grid-template-columns: 1fr; }
  .filter-bar { flex-direction: column; }
}
</style>
