<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '../../api'
import {
  adminCompanies as companies,
  ensureAdminCompanies,
  refreshAdminCompanies,
} from '../../composables/useOrgLists'

interface Company {
    id: number
    name: string
    sort_order: number
    is_active: boolean
}

const loading = ref(false)

// Company form
const showCompanyForm = ref(false)
const editingCompanyId = ref<number | null>(null)
const companyForm = ref({
    name: '',
    sort_order: 0,
    is_active: true,
})

// Delete confirm
const deleteConfirmId = ref<number | null>(null)

async function fetchCompanies() {
    loading.value = true
    try {
        await ensureAdminCompanies()
    } catch (e) {
        console.error('Failed to fetch companies:', e)
    } finally {
        loading.value = false
    }
}

// Company CRUD
function openCreateCompany() {
    editingCompanyId.value = null
    companyForm.value = {
        name: '',
        sort_order: 0,
        is_active: true,
    }
    showCompanyForm.value = true
}

function openEditCompany(company: Company) {
    editingCompanyId.value = company.id
    companyForm.value = {
        name: company.name,
        sort_order: company.sort_order,
        is_active: company.is_active,
    }
    showCompanyForm.value = true
}

async function saveCompany() {
    if (!companyForm.value.name) {
        alert('Vui lòng nhập tên công ty')
        return
    }
    try {
        if (editingCompanyId.value) {
            await api.put(`/admin/companies/${editingCompanyId.value}`, companyForm.value)
        } else {
            await api.post('/admin/companies', companyForm.value)
        }
        showCompanyForm.value = false
        await refreshAdminCompanies()
    } catch (e: any) {
        console.error('Failed to save company:', e)
        const msg: string =
            e?.response?.data?.message ||
            e?.message ||
            'Lỗi khi lưu công ty'
        alert(msg)
    }
}

async function toggleCompanyActive(company: Company) {
    try {
        await api.put(`/admin/companies/${company.id}`, { is_active: !company.is_active })
        await refreshAdminCompanies()
    } catch (e) {
        console.error('Failed to toggle company:', e)
    }
}

function confirmDelete(id: number) {
    deleteConfirmId.value = id
}

async function executeDelete() {
    if (deleteConfirmId.value === null) return
    try {
        await api.delete(`/admin/companies/${deleteConfirmId.value}`)
        deleteConfirmId.value = null
        await refreshAdminCompanies()
    } catch (e) {
        console.error('Failed to delete:', e)
    }
}

onMounted(fetchCompanies)
</script>

<template>
    <div>
        <!-- Page header -->
        <div class="flex items-center justify-between mb-5">
            <div>
                <h2 class="text-xl font-semibold text-gray-800">Quản lý Công ty</h2>
                <p class="text-sm text-gray-500 mt-0.5">Quản lý danh sách công ty</p>
            </div>
            <button class="btn-primary" @click="openCreateCompany">
                <span class="material-icon" style="font-size:18px">add</span>
                Thêm công ty
            </button>
        </div>

        <!-- Companies table -->
        <div class="content-card">
            <div v-if="loading" class="py-10 text-center text-gray-400">Đang tải...</div>
            <div v-else-if="companies.length === 0" class="py-10 text-center text-gray-400">Chưa có công ty nào</div>
            <div v-else class="overflow-x-auto">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th class="table-th" style="width:60px">TT</th>
                            <th class="table-th">Tên công ty</th>
                            <th class="table-th" style="width:100px">Trạng thái</th>
                            <th class="table-th text-center" style="width:100px">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="company in companies" :key="company.id" class="table-row"
                            :class="{ 'opacity-50': !company.is_active }">
                            <td class="table-td text-gray-400 text-center">{{ company.sort_order }}</td>
                            <td class="table-td">
                                <p class="font-medium text-gray-800">{{ company.name }}</p>
                            </td>
                            <td class="table-td">
                                <button class="status-badge cursor-pointer"
                                    :class="company.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
                                    @click="toggleCompanyActive(company)">
                                    {{ company.is_active ? 'Hiện' : 'Ẩn' }}
                                </button>
                            </td>
                            <td class="table-td">
                                <div class="flex items-center justify-center gap-1">
                                    <button class="action-btn action-btn-edit" @click="openEditCompany(company)"
                                        title="Sửa">
                                        <span class="material-icon text-base">edit</span>
                                    </button>
                                    <button class="action-btn action-btn-delete" @click="confirmDelete(company.id)"
                                        title="Xóa">
                                        <span class="material-icon text-base">delete</span>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Company Form Modal -->
        <div v-if="showCompanyForm" class="modal-overlay">
            <div class="modal-backdrop" @click="showCompanyForm = false"></div>
            <div class="modal-container modal-md">
                <div class="modal-header">
                    <h3 class="modal-title">{{ editingCompanyId ? 'Sửa công ty' : 'Thêm công ty' }}</h3>
                    <button class="modal-close" @click="showCompanyForm = false">
                        <span class="material-icon">close</span>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">Tên công ty <span class="text-red-500">*</span></label>
                        <input v-model="companyForm.name" type="text" class="form-input"
                            placeholder="VD: Công ty TNHH ABC" />
                    </div>
                    <div class="form-group">
                        <div class="toggle-row" @click="companyForm.is_active = !companyForm.is_active">
                            <div class="toggle-switch" :class="companyForm.is_active ? 'toggle-on' : 'toggle-off'">
                                <div class="toggle-knob"></div>
                            </div>
                            <span class="toggle-label">{{ companyForm.is_active ? 'Hiện' : 'Ẩn' }} (hiển thị trên
                                menu)</span>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel" @click="showCompanyForm = false">Hủy</button>
                    <button class="btn-primary" @click="saveCompany">{{ editingCompanyId ? 'Cập nhật' : 'Thêm mới'
                        }}</button>
                </div>
            </div>
        </div>

        <!-- Delete Confirm Modal -->
        <div v-if="deleteConfirmId !== null" class="modal-overlay">
            <div class="modal-backdrop" @click="deleteConfirmId = null"></div>
            <div class="modal-container modal-sm">
                <div class="modal-body text-center">
                    <div class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                        <span class="material-icon text-red-500 text-2xl">warning</span>
                    </div>
                    <h3 class="text-lg font-semibold text-gray-800 mb-2">Xác nhận xóa</h3>
                    <p class="text-sm text-gray-500 mb-6">Bạn có chắc chắn muốn xóa công ty này?</p>
                    <div class="flex gap-3 justify-center">
                        <button class="btn-cancel" @click="deleteConfirmId = null">Hủy</button>
                        <button class="btn-danger" @click="executeDelete">Xóa</button>
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

.data-table { width: 100%; font-size: 0.875rem; }

.table-th {
  padding: 0.75rem 1.25rem;
  text-align: left;
  font-weight: 500;
  color: #6b7280;
  background: #f9fafb;
  border-bottom: 1px solid #f3f4f6;
}

.table-row {
  border-bottom: 1px solid #f9fafb;
  transition: background 0.15s ease;
}

.table-row:hover { background: #f9fafb; }

.table-td { padding: 0.75rem 1.25rem; }

.status-badge {
  display: inline-block;
  padding: 0.125rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  border: none;
  transition: opacity 0.15s;
}

.status-badge:hover { opacity: 0.8; }

.action-btn {
  padding: 0.375rem;
  border-radius: 0.5rem;
  border: none;
  cursor: pointer;
  transition: background 0.15s ease;
  background: none;
}

.action-btn-edit { color: #3b82f6; }
.action-btn-edit:hover { background: #eff6ff; }
.action-btn-delete { color: #ef4444; }
.action-btn-delete:hover { background: #fef2f2; }

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

.btn-primary:hover { background: #333; }

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

.btn-cancel:hover { background: #f9fafb; }

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

.btn-danger:hover { background: #dc2626; }

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
  max-height: 90vh;
  overflow-y: auto;
}

.modal-md { max-width: 32rem; }
.modal-sm { max-width: 24rem; }

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
}

.modal-title { font-size: 1.1rem; font-weight: 600; color: #1f2937; }

.modal-close {
  color: #9ca3af;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.375rem;
  transition: color 0.15s;
}

.modal-close:hover { color: #4b5563; }

.modal-body { padding: 1.5rem; }

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
}

.form-group { margin-bottom: 1.25rem; }

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

.toggle-row {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  cursor: pointer;
  user-select: none;
}

.toggle-switch {
  width: 2.5rem;
  height: 1.375rem;
  border-radius: 9999px;
  position: relative;
  transition: background 0.2s ease;
  flex-shrink: 0;
}

.toggle-on { background: #15803d; }
.toggle-off { background: #d1d5db; }

.toggle-knob {
  position: absolute;
  top: 0.1875rem;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  transition: left 0.2s ease;
}

.toggle-on .toggle-knob { left: calc(100% - 1.1875rem); }
.toggle-off .toggle-knob { left: 0.1875rem; }

.toggle-label {
  font-size: 0.875rem;
  color: #4b5563;
}
</style>
