<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '../../api'

interface BannerItem {
  id: number
  title: string
  image_url: string
  link_url: string | null
  is_active: boolean
  created_at: string
}

const banners = ref<BannerItem[]>([])
const loading = ref(false)
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const showForm = ref(false)
const editingId = ref<number | null>(null)
const deleteConfirmId = ref<number | null>(null)

const form = ref({
  title: '',
  image_url: '',
  link_url: '',
  is_active: true,
})

async function fetchBanners() {
  loading.value = true
  try {
    const { data } = await api.get('/admin/banner')
    banners.value = data.data || []
  } catch (e) {
    console.error('Failed to fetch banners:', e)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  form.value = { title: '', image_url: '', link_url: '', is_active: true }
  showForm.value = true
}

function openEdit(item: BannerItem) {
  editingId.value = item.id
  form.value = {
    title: item.title,
    image_url: item.image_url || '',
    link_url: item.link_url || '',
    is_active: item.is_active,
  }
  showForm.value = true
}

async function saveBanner() {
  if (!form.value.title || !form.value.image_url) {
    alert('Vui lòng nhập tiêu đề và chọn ảnh')
    return
  }

  const payload = {
    title: form.value.title,
    image_url: form.value.image_url,
    link_url: form.value.link_url || null,
    is_active: form.value.is_active,
  }

  try {
    if (editingId.value !== null) {
      await api.put(`/admin/banner/${editingId.value}`, payload)
    } else {
      await api.post('/admin/banner', payload)
    }
    showForm.value = false
    editingId.value = null
    fetchBanners()
  } catch (e: any) {
    alert(e.response?.data?.message || 'Lỗi khi lưu banner')
  }
}

function confirmDelete(id: number) {
  deleteConfirmId.value = id
}

async function deleteBanner() {
  if (deleteConfirmId.value === null) return
  try {
    await api.delete(`/admin/banner/${deleteConfirmId.value}`)
    deleteConfirmId.value = null
    fetchBanners()
  } catch (e) {
    console.error('Failed to delete banner:', e)
  }
}

async function toggleStatus(item: BannerItem) {
  try {
    await api.put(`/admin/banner/${item.id}`, { is_active: !item.is_active })
    item.is_active = !item.is_active
  } catch (e) {
    console.error('Failed to toggle banner status:', e)
  }
}

function triggerFileInput() {
  fileInput.value?.click()
}

async function handleFileUpload(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await api.post('/admin/files/upload?type=slides', formData)
    form.value.image_url = `/uploads${data.data.file_path}`
  } catch (err: any) {
    const msg = err.response?.data?.message || err.message || 'Lỗi không xác định'
    alert(`Lỗi khi tải ảnh lên: ${msg}`)
  } finally {
    uploading.value = false
    target.value = ''
  }
}

function removeImage() {
  form.value.image_url = ''
}

onMounted(() => {
  fetchBanners()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Page header -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">Quản lý Banner</h1>
      </div>
      <button class="btn-primary" @click="openCreate">
        <span class="material-icon text-base">add</span>
        Thêm banner
      </button>
    </div>

    <!-- Banner table -->
    <div class="content-card">
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th class="table-th" style="width:50px">ID</th>
              <th class="table-th" style="width:100px">Ảnh</th>
              <th class="table-th">Tiêu đề</th>
              <th class="table-th" style="width:90px">Trạng thái</th>
              <th class="table-th text-center" style="width:110px">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="5" class="table-td text-center text-gray-400 py-10">Đang tải...</td>
            </tr>
            <tr v-else v-for="item in banners" :key="item.id" class="table-row">
              <td class="table-td text-gray-400">#{{ item.id }}</td>
              <td class="table-td">
                <img v-if="item.image_url" :src="item.image_url" alt="" class="table-thumb" />
                <span v-else class="text-gray-300 material-icon">image</span>
              </td>
              <td class="table-td title-cell">
                <p class="font-medium text-gray-800 truncate">{{ item.title }}</p>
              </td>
              <td class="table-td">
                <button
                  class="status-badge cursor-pointer"
                  :class="item.is_active ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'"
                  @click="toggleStatus(item)"
                  :title="'Click để ' + (item.is_active ? 'ẩn' : 'hiện')"
                >
                  {{ item.is_active ? 'Hiện' : 'Ẩn' }}
                </button>
              </td>
              <td class="table-td">
                <div class="flex items-center justify-center gap-1">
                  <button class="action-btn action-btn-edit" @click="openEdit(item)" title="Chỉnh sửa">
                    <span class="material-icon text-base">edit</span>
                  </button>
                  <button class="action-btn action-btn-delete" @click="confirmDelete(item.id)" title="Xóa">
                    <span class="material-icon text-base">delete</span>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!loading && banners.length === 0">
              <td colspan="5" class="table-td text-center text-gray-400 py-10">Chưa có banner nào</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Banner Form Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="showForm" class="modal-overlay">
          <div class="modal-backdrop" @click="showForm = false" />
          <div class="modal-container">
            <div class="modal-header">
              <h2 class="modal-title">
                {{ editingId !== null ? 'Chỉnh sửa banner' : 'Thêm banner mới' }}
              </h2>
              <button class="modal-close" @click="showForm = false">
                <span class="material-icon">close</span>
              </button>
            </div>

            <div class="modal-body">
              <div class="form-group">
                <label class="form-label">Tiêu đề <span class="text-red-500">*</span></label>
                <input v-model="form.title" type="text" class="form-input" placeholder="Nhập tiêu đề banner..." />
              </div>

              <div class="form-group">
                <label class="form-label">Ảnh banner <span class="text-red-500">*</span></label>
                <input
                  ref="fileInput"
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  class="hidden"
                  @change="handleFileUpload"
                />
                <div v-if="form.image_url" class="thumbnail-preview">
                  <img :src="form.image_url" alt="Banner" class="thumbnail-img" />
                  <div class="thumbnail-actions">
                    <button type="button" class="btn-change-img" @click="triggerFileInput" :disabled="uploading">
                      <span class="material-icon text-sm">edit</span> Đổi ảnh
                    </button>
                    <button type="button" class="btn-remove-img" @click="removeImage">
                      <span class="material-icon text-sm">delete</span> Xóa
                    </button>
                  </div>
                </div>
                <button
                  v-else
                  type="button"
                  class="upload-area"
                  @click="triggerFileInput"
                  :disabled="uploading"
                >
                  <span v-if="uploading" class="material-icon animate-spin">progress_activity</span>
                  <span v-else class="material-icon text-3xl text-slate-400">cloud_upload</span>
                  <span class="text-sm text-slate-500 mt-1">
                    {{ uploading ? 'Đang tải lên...' : 'Nhấn để chọn ảnh từ máy tính' }}
                  </span>
                </button>
              </div>

              <div class="form-group">
                <label class="form-label">Trạng thái</label>
                <div class="flex gap-4">
                  <label class="radio-label">
                    <input type="radio" v-model="form.is_active" :value="true" class="radio-input" />
                    <span>Hiện</span>
                  </label>
                  <label class="radio-label">
                    <input type="radio" v-model="form.is_active" :value="false" class="radio-input" />
                    <span>Ẩn</span>
                  </label>
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button class="btn-cancel" @click="showForm = false">Hủy</button>
              <button class="btn-primary" @click="saveBanner">
                {{ editingId !== null ? 'Cập nhật' : 'Tạo mới' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete confirmation -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div v-if="deleteConfirmId !== null" class="modal-overlay">
          <div class="modal-backdrop" @click="deleteConfirmId = null" />
          <div class="modal-container modal-sm">
            <div class="modal-body text-center">
              <div class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <span class="material-icon text-red-500 text-2xl">warning</span>
              </div>
              <h3 class="text-lg font-semibold text-gray-800 mb-2">Xác nhận xóa</h3>
              <p class="text-sm text-gray-500 mb-6">Bạn có chắc chắn muốn xóa banner này? Hành động này không thể hoàn tác.</p>
              <div class="flex gap-3 justify-center">
                <button class="btn-cancel" @click="deleteConfirmId = null">Hủy</button>
                <button class="btn-danger" @click="deleteBanner">Xóa</button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
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
  table-layout: fixed;
}

.title-cell { overflow: hidden; }

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

.table-thumb {
  width: 72px;
  height: 44px;
  object-fit: cover;
  border-radius: 0.375rem;
  border: 1px solid #e5e7eb;
}

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
  max-width: 42rem;
  max-height: 90vh;
  overflow-y: auto;
}

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

.radio-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  color: #4b5563;
}

.radio-input { accent-color: #f0a500; }

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

.thumbnail-preview {
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;
  max-width: 280px;
}

.thumbnail-img {
  width: 100%;
  height: 160px;
  object-fit: cover;
  display: block;
}

.thumbnail-actions {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
}

.btn-change-img {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  background: #fff;
  color: #374151;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-change-img:hover { background: #f3f4f6; }

.btn-remove-img {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  border: 1px solid #fecaca;
  border-radius: 0.375rem;
  background: #fff;
  color: #ef4444;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-remove-img:hover { background: #fef2f2; }
</style>
