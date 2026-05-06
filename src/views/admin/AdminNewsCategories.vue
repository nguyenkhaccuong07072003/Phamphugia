<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '../../api'

interface NewsCategory {
  id: number
  name: string
  slug: string
  sort_order: number
  is_active: boolean
}

const categories = ref<NewsCategory[]>([])
const loading = ref(false)
const showCategoryForm = ref(false)
const editingCategoryId = ref<number | null>(null)
const deleteConfirmId = ref<number | null>(null)

const categoryForm = ref({
  name: '',
  sort_order: 0,
  is_active: true,
})

async function fetchCategories() {
  loading.value = true
  try {
    const { data } = await api.get('/admin/news-categories')
    categories.value = data.data || []
  } catch (e) {
    console.error('Failed to fetch categories:', e)
    categories.value = []
  } finally {
    loading.value = false
  }
}

function openCreateCategory() {
  editingCategoryId.value = null
  categoryForm.value = {
    name: '',
    sort_order: 0,
    is_active: true,
  }
  showCategoryForm.value = true
}

function openEditCategory(category: NewsCategory) {
  editingCategoryId.value = category.id
  categoryForm.value = {
    name: category.name,
    sort_order: category.sort_order,
    is_active: category.is_active,
  }
  showCategoryForm.value = true
}

async function saveCategory() {
  if (!categoryForm.value.name.trim()) {
    alert('Vui lòng nhập tên category')
    return
  }

  try {
    if (editingCategoryId.value) {
      await api.put(`/admin/news-categories/${editingCategoryId.value}`, categoryForm.value)
    } else {
      await api.post('/admin/news-categories', categoryForm.value)
    }
    showCategoryForm.value = false
    await fetchCategories()
  } catch (e: any) {
    console.error('Failed to save category:', e)
    alert(e?.response?.data?.message || e?.message || 'Lỗi khi lưu category')
  }
}

async function toggleCategoryActive(category: NewsCategory) {
  try {
    await api.put(`/admin/news-categories/${category.id}`, {
      is_active: !category.is_active,
    })
    await fetchCategories()
  } catch (e) {
    console.error('Failed to toggle category:', e)
  }
}

function confirmDelete(id: number) {
  deleteConfirmId.value = id
}

async function executeDelete() {
  if (deleteConfirmId.value === null) return
  try {
    await api.delete(`/admin/news-categories/${deleteConfirmId.value}`)
    deleteConfirmId.value = null
    await fetchCategories()
  } catch (e: any) {
    console.error('Failed to delete category:', e)
    alert(e?.response?.data?.message || e?.message || 'Lỗi khi xóa category')
  }
}

onMounted(fetchCategories)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-5">
      <div>
        <h2 class="text-xl font-semibold text-gray-800">Quản lý Category</h2>
        <p class="text-sm text-gray-500 mt-0.5">Thêm, sửa, ẩn hiện và xóa danh mục tin tức / sản phẩm</p>
      </div>
      <button class="btn-primary" @click="openCreateCategory">
        <span class="material-icon" style="font-size:18px">add</span>
        Thêm category
      </button>
    </div>

    <div class="content-card">
      <div v-if="loading" class="py-10 text-center text-gray-400">Đang tải...</div>
      <div v-else-if="categories.length === 0" class="py-10 text-center text-gray-400">Chưa có category nào</div>
      <div v-else class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th class="table-th" style="width:80px">TT</th>
              <th class="table-th">Tên category</th>
              <th class="table-th" style="width:180px">Slug</th>
              <th class="table-th" style="width:110px">Trạng thái</th>
              <th class="table-th text-center" style="width:110px">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="category in categories"
              :key="category.id"
              class="table-row"
              :class="{ 'opacity-50': !category.is_active }"
            >
              <td class="table-td text-gray-400 text-center">{{ category.sort_order }}</td>
              <td class="table-td">
                <p class="font-medium text-gray-800">{{ category.name }}</p>
              </td>
              <td class="table-td text-sm text-gray-500">{{ category.slug }}</td>
              <td class="table-td">
                <button
                  class="status-badge cursor-pointer"
                  :class="category.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
                  @click="toggleCategoryActive(category)"
                >
                  {{ category.is_active ? 'Hiện' : 'Ẩn' }}
                </button>
              </td>
              <td class="table-td">
                <div class="flex items-center justify-center gap-1">
                  <button class="action-btn action-btn-edit" @click="openEditCategory(category)" title="Sửa">
                    <span class="material-icon text-base">edit</span>
                  </button>
                  <button class="action-btn action-btn-delete" @click="confirmDelete(category.id)" title="Xóa">
                    <span class="material-icon text-base">delete</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="showCategoryForm" class="modal-overlay">
      <div class="modal-backdrop" @click="showCategoryForm = false"></div>
      <div class="modal-container modal-md">
        <div class="modal-header">
          <h3 class="modal-title">{{ editingCategoryId ? 'Sửa category' : 'Thêm category' }}</h3>
          <button class="modal-close" @click="showCategoryForm = false">
            <span class="material-icon">close</span>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Tên category <span class="text-red-500">*</span></label>
            <input v-model="categoryForm.name" type="text" class="form-input" placeholder="VD: Sản phẩm" />
          </div>
          <div class="form-group">
            <label class="form-label">Thứ tự</label>
            <input v-model.number="categoryForm.sort_order" type="number" min="0" class="form-input" />
          </div>
          <div class="form-group">
            <div class="toggle-row" @click="categoryForm.is_active = !categoryForm.is_active">
              <div class="toggle-switch" :class="categoryForm.is_active ? 'toggle-on' : 'toggle-off'">
                <div class="toggle-knob"></div>
              </div>
              <span class="toggle-label">{{ categoryForm.is_active ? 'Hiện' : 'Ẩn' }}</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="showCategoryForm = false">Hủy</button>
          <button class="btn-primary" @click="saveCategory">{{ editingCategoryId ? 'Cập nhật' : 'Thêm mới' }}</button>
        </div>
      </div>
    </div>

    <div v-if="deleteConfirmId !== null" class="modal-overlay">
      <div class="modal-backdrop" @click="deleteConfirmId = null"></div>
      <div class="modal-container modal-sm">
        <div class="modal-body text-center">
          <div class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span class="material-icon text-red-500 text-2xl">warning</span>
          </div>
          <h3 class="text-lg font-semibold text-gray-800 mb-2">Xác nhận xóa</h3>
          <p class="text-sm text-gray-500 mb-6">Bạn có chắc chắn muốn xóa category này?</p>
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
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: space-between;
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
}

.modal-close:hover { color: #4b5563; }

.modal-body { padding: 1.5rem; }

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #f3f4f6;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
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
}

.form-input:focus {
  border-color: #f0a500;
  box-shadow: 0 0 0 3px rgba(240, 165, 0, 0.1);
}

.toggle-row {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  user-select: none;
}

.toggle-switch {
  width: 44px;
  height: 24px;
  border-radius: 9999px;
  position: relative;
  transition: background-color 0.2s;
}

.toggle-on { background: #22c55e; }
.toggle-off { background: #d1d5db; }

.toggle-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 9999px;
  background: #fff;
  transition: transform 0.2s;
}

.toggle-on .toggle-knob { transform: translateX(20px); }

.toggle-label {
  font-size: 0.875rem;
  color: #4b5563;
}
</style>
