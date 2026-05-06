<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
//import Editor from '@tinymce/tinymce-vue'
import api from '../../api'

interface Category {
  id: number
  name: string
}

interface CatalogueBlock {
  id: string
  title: string
  image: string | null
  specifications: string
}

interface NewsItem {
  id: number
  title: string
  content: string
  specifications: string | null
  catalogue_blocks?: CatalogueBlock[]
  thumbnail_url: string | null
  image_urls?: string[] | null
  category_id: number
  is_normal: boolean
  is_highlight: boolean
  is_slider: boolean
  slider_sort_order: number
  is_published: boolean
  is_pinned: boolean
  published_at: string | null
  created_at: string
  category?: Category
  author?: { id: number; full_name: string }
}

// State
const newsList = ref<NewsItem[]>([])
const categories = ref<Category[]>([])
const loading = ref(false)
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const showForm = ref(false)
const editingId = ref<number | null>(null)
const searchQuery = ref('')
const filterCategory = ref('')
const filterStatus = ref('')
const filterDisplayFilter = ref('')
const deleteConfirmId = ref<number | null>(null)

// Pagination
const currentPage = ref(1)
const totalPages = ref(1)
const totalItems = ref(0)
const perPage = ref(15)
const perPageOptions = [10, 15, 25, 50]

//const tinymceApiKey = import.meta.env.VITE_TINYMCE_API_KEY || ''


// const tinymceConfig = {
//   height: 400,
//   menubar: false,
//   plugins: 'lists image code fullscreen autolink',
//   toolbar: 'undo redo | fontfamily fontsize | bold italic underline | alignleft aligncenter alignright alignjustify | bullist numlist | customImageUpload | fullscreen code',
//   font_family_formats: 'Times New Roman=times new roman,times,serif;Arial=arial,helvetica,sans-serif',
//   font_size_formats: '8pt 9pt 10pt 11pt 12pt 14pt 16pt 18pt 20pt 22pt 24pt 26pt 28pt 36pt 48pt 72pt',
//   browser_spellcheck: true,
//   resize: true,
//   toolbar_sticky: true,
//   content_style: 'body { font-family: "Times New Roman", Times, serif; font-size: 14pt; line-height: 1.5; padding: 12px; }',
//   automatic_uploads: true,
//   paste_data_images: true,
//   images_upload_handler: async (blobInfo: any) => uploadEditorImage(blobInfo.blob()),
//   file_picker_types: 'image',
//   file_picker_callback: (_callback: any, _value: string, meta: any) => {
//     if (meta.filetype === 'image') {
//       triggerEditorImageInput()
//     }
//   },
//   setup: (editor: any) => {
//     currentEditor.value = editor
//     editor.ui.registry.addButton('customImageUpload', {
//       text: 'Tải ảnh',
//       tooltip: 'Tải ảnh vào nội dung',
//       onAction: () => triggerEditorImageInput(),
//     })
//   },
//   branding: false,
//   promotion: false,
// }

const form = ref({
  title: '',
  category_id: '',
  catalogue_blocks: [] as CatalogueBlock[],
  thumbnail_url: '',
  is_normal: true,
  is_highlight: false,
  is_slider: false,
  slider_sort_order: 0,
  is_published: false,
})

// Fetch categories
async function fetchCategories() {
  try {
    const { data } = await api.get('/admin/news-categories')
    categories.value = data.data || data
  } catch (e) {
    console.error('Failed to fetch categories:', e)
  }
}

// Fetch news
async function fetchNews() {
  loading.value = true
  try {
    const params: Record<string, string | number> = {
      page: currentPage.value,
      limit: perPage.value,
    }
    if (searchQuery.value) params.search = searchQuery.value
    if (filterCategory.value) params.category_id = filterCategory.value
    if (filterStatus.value) params.status = filterStatus.value
    if (filterDisplayFilter.value) params.display_filter = filterDisplayFilter.value

    const { data } = await api.get('/admin/news', { params })
    newsList.value = data.data || []
    totalPages.value = data.meta?.totalPages || 1
    totalItems.value = data.meta?.total || 0
  } catch (e) {
    console.error('Failed to fetch news:', e)
  } finally {
    loading.value = false
  }
}

// Debounced search
let searchTimeout: ReturnType<typeof setTimeout>
watch(searchQuery, () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    currentPage.value = 1
    fetchNews()
  }, 300)
})

watch([filterCategory, filterStatus, filterDisplayFilter, perPage], () => {
  currentPage.value = 1
  fetchNews()
})

onMounted(() => {
  fetchCategories()
  fetchNews()
})

// Actions
function openCreate() {
  editingId.value = null
  form.value = {
    title: '',
    category_id: '',
    catalogue_blocks: [],
    thumbnail_url: '',
    is_normal: true,
    is_highlight: false,
    is_slider: false,
    slider_sort_order: 0,
    is_published: false,
  }
  showForm.value = true
}

async function openEdit(item: NewsItem) {
  try {
    const { data } = await api.get(`/admin/news/${item.id}`)
    const fullItem = data.data as NewsItem

    editingId.value = fullItem.id
    form.value = {
      title: fullItem.title,
      category_id: String(fullItem.category_id),
      catalogue_blocks: Array.isArray(fullItem.catalogue_blocks) ? [...fullItem.catalogue_blocks] : [],
      thumbnail_url: fullItem.thumbnail_url || '',
      is_normal: fullItem.is_normal,
      is_highlight: fullItem.is_highlight,
      is_slider: fullItem.is_slider,
      slider_sort_order: fullItem.slider_sort_order || 0,
      is_published: fullItem.is_published,
    }

    showForm.value = true
  } catch (e: any) {
    console.error('Failed to load article detail:', e)
    alert(e?.response?.data?.message || e?.message || 'Không tải được dữ liệu bài viết để chỉnh sửa')
  }
}

function closeForm() {
  showForm.value = false
}

async function saveNews() {
  if (!form.value.title || !form.value.category_id) return

  const payload = {
    title: form.value.title,
    category_id: Number(form.value.category_id),
    content: '',
    catalogue_blocks: form.value.catalogue_blocks,
    thumbnail_url: form.value.thumbnail_url || null,
    image_urls: [],
    is_normal: form.value.is_normal,
    is_highlight: form.value.is_highlight,
    is_slider: form.value.is_slider,
    slider_sort_order: Number(form.value.slider_sort_order),
    is_published: form.value.is_published,
  }

  try {
    if (editingId.value !== null) {
      await api.put(`/admin/news/${editingId.value}`, payload)
    } else {
      await api.post('/admin/news', payload)
    }
    showForm.value = false
    editingId.value = null
    fetchNews()
  } catch (e: any) {
    console.error('Failed to save news:', e)
    alert(e.response?.data?.message || 'Lỗi khi lưu tin tức')
  }
}

function confirmDelete(id: number) {
  deleteConfirmId.value = id
}

async function deleteNews() {
  if (deleteConfirmId.value === null) return
  try {
    await api.delete(`/admin/news/${deleteConfirmId.value}`)
    deleteConfirmId.value = null
    fetchNews()
  } catch (e) {
    console.error('Failed to delete news:', e)
  }
}

async function toggleStatus(item: NewsItem) {
  try {
    await api.patch(`/admin/news/${item.id}/toggle-publish`)
    item.is_published = !item.is_published
  } catch (e) {
    console.error('Failed to toggle status:', e)
  }
}

async function togglePin(item: NewsItem) {
  try {
    await api.patch(`/admin/news/${item.id}/toggle-pin`)
    item.is_pinned = !item.is_pinned
  } catch (e) {
    console.error('Failed to toggle pin:', e)
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
    const { data } = await api.post('/admin/files/upload?type=images', formData)
    form.value.thumbnail_url = `/uploads${data.data.file_path}`
  } catch (err: any) {
    console.error('Upload failed:', err)
    const msg = err.response?.data?.message || err.message || 'Lỗi không xác định'
    alert(`Lỗi khi tải ảnh lên: ${msg}`)
  } finally {
    uploading.value = false
    target.value = ''
  }
}

function removeThumbnail() {
  form.value.thumbnail_url = ''
}

function goToPage(page: number) {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
  fetchNews()
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function getCategoryName(item: NewsItem) {
  return item.category?.name || '—'
}

// ============ CATALOGUE BLOCKS MANAGEMENT ============

const catalogueBlockFileInputs = ref<Map<string, HTMLInputElement>>(new Map())
const draggedBlockIndex = ref<number | null>(null)

interface BlockUploadState {
  [key: string]: boolean
}
const blockUploading = ref<BlockUploadState>({})

function addCatalogueBlock() {
  const newBlock: CatalogueBlock = {
    id: `block-${Date.now()}`,
    title: '',
    image: null,
    specifications: '',
  }
  form.value.catalogue_blocks.push(newBlock)
}

function removeCatalogueBlock(index: number) {
  form.value.catalogue_blocks.splice(index, 1)
}

function setBlockFileInput(blockId: string, el: any) {
  if (el) {
    catalogueBlockFileInputs.value.set(blockId, el as HTMLInputElement)
  } else {
    catalogueBlockFileInputs.value.delete(blockId)
  }
}

function triggerBlockImageInput(blockId: string) {
  const input = catalogueBlockFileInputs.value.get(blockId)
  input?.click()
}

async function handleBlockImageUpload(e: Event, blockId: string, blockIndex: number) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  blockUploading.value[blockId] = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await api.post('/admin/files/upload?type=images', formData)
    const block = form.value.catalogue_blocks[blockIndex]
    if (block) {
      block.image = `/uploads${data.data.file_path}`
    }
  } catch (err: any) {
    console.error('Block image upload failed:', err)
    alert(`Lỗi khi tải ảnh block: ${err.response?.data?.message || err.message || 'Lỗi không xác định'}`)
  } finally {
    blockUploading.value[blockId] = false
    target.value = ''
  }
}

function removeBlockImage(blockIndex: number) {
  const block = form.value.catalogue_blocks[blockIndex]
  if (block) {
    block.image = null
  }
}

function startDragBlock(index: number) {
  draggedBlockIndex.value = index
}

function onDragOverBlock(e: DragEvent) {
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
}

function onDropBlock(e: DragEvent, targetIndex: number) {
  e.preventDefault()
  if (draggedBlockIndex.value === null || draggedBlockIndex.value === targetIndex) return

  const draggedBlock = form.value.catalogue_blocks[draggedBlockIndex.value]
  if (!draggedBlock) return

  form.value.catalogue_blocks.splice(draggedBlockIndex.value, 1)
  form.value.catalogue_blocks.splice(targetIndex, 0, draggedBlock)
  draggedBlockIndex.value = null
}

function moveBlockUp(index: number) {
  if (index === 0) return
  const block1 = form.value.catalogue_blocks[index]
  const block2 = form.value.catalogue_blocks[index - 1]
  if (block1 && block2) {
    form.value.catalogue_blocks[index] = block2
    form.value.catalogue_blocks[index - 1] = block1
  }
}

function moveBlockDown(index: number) {
  if (index >= form.value.catalogue_blocks.length - 1) return
  const block1 = form.value.catalogue_blocks[index]
  const block2 = form.value.catalogue_blocks[index + 1]
  if (block1 && block2) {
    form.value.catalogue_blocks[index] = block2
    form.value.catalogue_blocks[index + 1] = block1
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Page header -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">Quản lý tin tức</h1>
      </div>
      <button class="btn-primary" @click="openCreate">
        <span class="material-icon text-base">add</span>
        Thêm tin tức
      </button>
    </div>

    <!-- Filters -->
    <div class="content-card">
      <div class="filter-bar">
        <div class="search-wrapper">
          <span class="search-icon material-icon">search</span>
          <input v-model="searchQuery" type="text" placeholder="Tìm kiếm tin tức..." class="search-input" />
        </div>
        <select v-model="filterCategory" class="filter-select">
          <option value="">Tất cả danh mục</option>
          <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
        </select>
        <select v-model="filterStatus" class="filter-select">
          <option value="">Tất cả trạng thái</option>
          <option value="published">Đã đăng</option>
          <option value="draft">Bản nháp</option>
        </select>
        <select v-model="filterDisplayFilter" class="filter-select">
          <option value="">Tất cả loại</option>
          <option value="normal">Tin thường</option>
          <option value="highlight">Nổi bật</option>
          <option value="slider">Slider</option>
        </select>
      </div>
    </div>

    <!-- News table -->
    <div class="content-card">
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th class="table-th" style="width:50px">ID</th>
              <th class="table-th">Tiêu đề</th>
              <th class="table-th" style="width:150px">Danh mục</th>
              <th class="table-th" style="width:250px">Trạng thái</th>
              <th class="table-th" style="width:200px">Ngày đăng</th>
              <th class="table-th text-center" style="width:130px">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="6" class="table-td text-center text-gray-400 py-10">
                Đang tải...
              </td>
            </tr>
            <tr v-else v-for="item in newsList" :key="item.id" class="table-row">
              <td class="table-td text-gray-400">#{{ item.id }}</td>
              <td class="table-td title-cell">
                <p class="font-medium text-gray-800 truncate">{{ item.title }}</p>
              </td>
              <td class="table-td">
                <span class="inline-block px-2 py-0.5 rounded text-xs font-medium"
                  style="background: #6b728020; color: #6b7280">
                  {{ getCategoryName(item) }}
                </span>
              </td>
              <td class="table-td">
                <div class="flex items-center gap-1 flex-nowrap whitespace-nowrap">
                  <button class="status-badge cursor-pointer shrink-0"
                    :class="item.is_published ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'"
                    @click="toggleStatus(item)"
                    :title="'Click để chuyển sang ' + (item.is_published ? 'bản nháp' : 'đã đăng')">
                    {{ item.is_published ? 'Đã đăng' : 'Bản nháp' }}
                  </button>
                  <span v-if="item.is_normal" class="type-tag type-tag-normal shrink-0">Thường</span>
                  <span v-if="item.is_highlight" class="type-tag type-tag-highlight shrink-0">Nổi bật</span>
                  <span v-if="item.is_slider" class="type-tag type-tag-slider shrink-0">Slider</span>
                </div>
              </td>
              <td class="table-td text-gray-500 text-sm">{{ formatDate(item.published_at || item.created_at) }}</td>
              <td class="table-td">
                <div class="flex items-center justify-center gap-1">
                  <button class="action-btn" :class="item.is_pinned ? 'text-amber-500' : 'text-gray-400'"
                    @click="togglePin(item)" :title="item.is_pinned ? 'Bỏ ghim' : 'Ghim bài'">
                    <span class="material-icon text-base">push_pin</span>
                  </button>
                  <button class="action-btn action-btn-edit" @click="openEdit(item)" title="Chỉnh sửa">
                    <span class="material-icon text-base">edit</span>
                  </button>
                  <button class="action-btn action-btn-delete" @click="confirmDelete(item.id)" title="Xóa">
                    <span class="material-icon text-base">delete</span>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!loading && newsList.length === 0">
              <td colspan="6" class="table-td text-center text-gray-400 py-10">
                Không tìm thấy tin tức nào
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="pagination-bar">
        <div class="pagination-left">
          <span class="pagination-info">Hiển thị</span>
          <select v-model.number="perPage" class="perpage-select">
            <option v-for="opt in perPageOptions" :key="opt" :value="opt">{{ opt }}</option>
          </select>
          <span class="pagination-info">/ {{ totalItems }} bài</span>
        </div>
        <div v-if="totalPages > 1" class="pagination-center">
          <button class="pagination-btn" :disabled="currentPage <= 1" @click="goToPage(currentPage - 1)">
            <span class="material-icon text-base">chevron_left</span>
          </button>
          <template v-for="p in totalPages" :key="p">
            <button v-if="p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)"
              class="pagination-btn" :class="{ 'pagination-btn-active': p === currentPage }" @click="goToPage(p)">
              {{ p }}
            </button>
            <span v-else-if="p === currentPage - 2 || p === currentPage + 2" class="pagination-dots">...</span>
          </template>
          <button class="pagination-btn" :disabled="currentPage >= totalPages" @click="goToPage(currentPage + 1)">
            <span class="material-icon text-base">chevron_right</span>
          </button>
        </div>
        <div class="pagination-right">
          <span class="pagination-info">Trang {{ currentPage }}/{{ totalPages }}</span>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <Teleport to="body">
      <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0"
        enter-to-class="opacity-100" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100"
        leave-to-class="opacity-0">
        <div v-if="showForm" class="modal-overlay">
          <div class="modal-backdrop" @click="closeForm" />
          <div class="modal-container">
            <div class="modal-header">
              <h2 class="modal-title">
                {{ editingId !== null ? 'Chỉnh sửa tin tức' : 'Thêm tin tức mới' }}
              </h2>
              <button class="modal-close" @click="closeForm">
                <span class="material-icon">close</span>
              </button>
            </div>

            <div class="modal-body">
              <!-- Title -->
              <div class="form-group">
                <label class="form-label">Tiêu đề <span class="text-red-500">*</span></label>
                <input v-model="form.title" type="text" class="form-input" placeholder="Nhập tiêu đề tin tức..." />
              </div>

              <!-- Category + Display Type -->
              <div class="grid grid-cols-2 gap-4">
                <div class="form-group">
                  <label class="form-label">Danh mục <span class="text-red-500">*</span></label>
                  <select v-model="form.category_id" class="form-input">
                    <option value="" disabled>Chọn danh mục</option>
                    <option v-for="cat in categories" :key="cat.id" :value="String(cat.id)">{{ cat.name }}</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Vị trí hiển thị</label>
                  <div class="flex gap-4 mt-1">
                    <label class="checkbox-label">
                      <input type="checkbox" v-model="form.is_normal" class="checkbox-input" />
                      <span>Tin thường</span>
                    </label>
                    <label class="checkbox-label">
                      <input type="checkbox" v-model="form.is_highlight" class="checkbox-input" />
                      <span>Nổi bật</span>
                    </label>
                    <label class="checkbox-label">
                      <input type="checkbox" v-model="form.is_slider" class="checkbox-input" />
                      <span>Slider</span>
                    </label>
                  </div>
                </div>
              </div>

              <!-- Slider sort order (only when is_slider checked) -->
              <div v-if="form.is_slider" class="form-group">
                <label class="form-label">Thứ tự slider</label>
                <input v-model.number="form.slider_sort_order" type="number" min="0" class="form-input"
                  style="max-width: 120px" />
              </div>

              <!-- Thumbnail & Specifications -->
              <div class="grid grid-cols-2 gap-4">
                <div class="form-group">
                  <label class="form-label">Ảnh đại diện</label>
                  <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/gif,image/webp" class="hidden"
                    @change="handleFileUpload" />
                  <div v-if="form.thumbnail_url" class="thumbnail-preview">
                    <img :src="form.thumbnail_url" alt="Thumbnail" class="thumbnail-img" />
                    <div class="thumbnail-actions">
                      <button type="button" class="btn-change-img" @click="triggerFileInput" :disabled="uploading">
                        <span class="material-icon text-sm">edit</span> Đổi ảnh
                      </button>
                      <button type="button" class="btn-remove-img" @click="removeThumbnail">
                        <span class="material-icon text-sm">delete</span> Xóa
                      </button>
                    </div>
                  </div>
                  <button v-else type="button" class="upload-area h-34.5" @click="triggerFileInput"
                    :disabled="uploading">
                    <span v-if="uploading" class="material-icon animate-spin">progress_activity</span>
                    <span v-else class="material-icon text-3xl text-slate-400">cloud_upload</span>
                    <span class="text-sm text-slate-500 mt-1">
                      {{ uploading ? 'Đang tải lên...' : 'Chọn ảnh' }}
                    </span>
                  </button>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Catalogue Blocks (Thiết bị / Thành phần)</label>
                <div class="space-y-4 mb-4">
                  <div v-for="(block, index) in form.catalogue_blocks" :key="block.id" class="catalogue-block-card"
                    draggable="true" @dragstart="startDragBlock(index)" @dragover="onDragOverBlock"
                    @drop="onDropBlock($event, index)">
                    <!-- Block Header with Move Controls -->
                    <div class="catalogue-block-header">
                      <div class="flex items-center gap-2">
                        <span class="material-icon text-gray-400 cursor-move">drag_handle</span>
                        <input v-model="block.title" type="text" placeholder="Nhập tên thiết bị / thành phần..."
                          class="form-input flex-1 py-2 px-3" />
                      </div>
                      <div class="flex items-center gap-1">
                        <button type="button" class="action-btn" :disabled="index === 0" @click="moveBlockUp(index)"
                          title="Di chuyển lên">
                          <span class="material-icon text-sm">arrow_upward</span>
                        </button>
                        <button type="button" class="action-btn" :disabled="index >= form.catalogue_blocks.length - 1"
                          @click="moveBlockDown(index)" title="Di chuyển xuống">
                          <span class="material-icon text-sm">arrow_downward</span>
                        </button>
                        <button type="button" class="action-btn action-btn-delete" @click="removeCatalogueBlock(index)"
                          title="Xóa block">
                          <span class="material-icon text-sm">delete</span>
                        </button>
                      </div>
                    </div>

                    <!-- Block Image Upload -->
                    <div class="px-4 py-3 border-t border-gray-200">
                      <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" class="hidden"
                        @change="(e) => handleBlockImageUpload(e, block.id, index)"
                        :ref="(el) => setBlockFileInput(block.id, el)" />
                      <div v-if="block.image" class="thumbnail-preview mb-3">
                        <img :src="block.image" :alt="block.title" class="thumbnail-img" />
                        <div class="thumbnail-actions">
                          <button type="button" class="btn-change-img" @click="triggerBlockImageInput(block.id)"
                            :disabled="blockUploading[block.id]">
                            <span class="material-icon text-sm">edit</span> Đổi ảnh
                          </button>
                          <button type="button" class="btn-remove-img" @click="removeBlockImage(index)">
                            <span class="material-icon text-sm">delete</span> Xóa
                          </button>
                        </div>
                      </div>
                      <button v-else type="button" class="upload-area h-25"
                        @click="triggerBlockImageInput(block.id)" :disabled="blockUploading[block.id]">
                        <span v-if="blockUploading[block.id]"
                          class="material-icon animate-spin text-sm">progress_activity</span>
                        <span v-else class="material-icon text-2xl text-slate-400">cloud_upload</span>
                        <span class="text-xs text-slate-500 mt-1">
                          {{ blockUploading[block.id] ? 'Đang tải lên...' : 'Tải ảnh thiết bị' }}
                        </span>
                      </button>
                    </div>

                    <!-- Block Specifications -->
                    <div class="px-4 py-3 border-t border-gray-200">
                      <label class="form-label text-xs">Thông số kỹ thuật</label>
                      <textarea v-model="block.specifications"
                        placeholder="Nhập thông số, ví dụ:&#10;- Vật liệu: ...&#10;- Kích thước: ..."
                        class="form-input h-25 resize-none text-xs"></textarea>
                    </div>
                  </div>

                  <!-- Add new block button -->
                  <button type="button"
                    class="w-full py-2 px-4 border border-dashed border-gray-300 rounded text-gray-600 hover:bg-gray-50 transition flex items-center justify-center gap-2"
                    @click="addCatalogueBlock">
                    <span class="material-icon text-base">add</span>
                    Thêm thiết bị / thành phần
                  </button>
                </div>
              </div>

              <!-- Status -->
              <div class="form-group">
                <label class="form-label">Trạng thái</label>
                <div class="flex gap-4">
                  <label class="radio-label">
                    <input type="radio" v-model="form.is_published" :value="false" class="radio-input" />
                    <span>Bản nháp</span>
                  </label>
                  <label class="radio-label">
                    <input type="radio" v-model="form.is_published" :value="true" class="radio-input" />
                    <span>Đăng ngay</span>
                  </label>
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button class="btn-cancel" @click="closeForm">Hủy</button>
              <button class="btn-primary" @click="saveNews">
                {{ editingId !== null ? 'Cập nhật' : 'Tạo mới' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete confirmation modal -->
    <Teleport to="body">
      <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0"
        enter-to-class="opacity-100" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100"
        leave-to-class="opacity-0">
        <div v-if="deleteConfirmId !== null" class="modal-overlay">
          <div class="modal-backdrop" @click="deleteConfirmId = null" />
          <div class="modal-container modal-sm">
            <div class="modal-body text-center">
              <div class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <span class="material-icon text-red-500 text-2xl">warning</span>
              </div>
              <h3 class="text-lg font-semibold text-gray-800 mb-2">Xác nhận xóa</h3>
              <p class="text-sm text-gray-500 mb-6">Bạn có chắc chắn muốn xóa tin tức này? Hành động này không thể hoàn
                tác.
              </p>
              <div class="flex gap-3 justify-center">
                <button class="btn-cancel" @click="deleteConfirmId = null">Hủy</button>
                <button class="btn-danger" @click="deleteNews">Xóa</button>
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

.line-clamp-1 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Content Card */
.content-card {
  background: #fff;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

/* Filter Bar */
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
}

.search-wrapper {
  position: relative;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
  font-size: 18px;
}

.search-input {
  padding: 0.5rem 1rem 0.5rem 2.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  outline: none;
  width: 16rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search-input:focus {
  border-color: #f0a500;
  box-shadow: 0 0 0 3px rgba(240, 165, 0, 0.1);
}

.filter-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  outline: none;
  background: #fff;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.filter-select:focus {
  border-color: #f0a500;
  box-shadow: 0 0 0 3px rgba(240, 165, 0, 0.1);
}

/* Table */
.data-table {
  width: 100%;
  font-size: 0.875rem;
  table-layout: fixed;
}

.title-cell {
  overflow: hidden;
}

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

.table-row:hover {
  background: #f9fafb;
}

.table-td {
  padding: 0.75rem 1.25rem;
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

.status-badge:hover {
  opacity: 0.8;
}

/* Action buttons */
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

/* Pagination */
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 1.5rem;
  border-top: 1px solid #f3f4f6;
}

.pagination-left,
.pagination-right {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-width: 140px;
}

.pagination-right {
  justify-content: flex-end;
}

.pagination-center {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.pagination-info {
  font-size: 0.8125rem;
  color: #6b7280;
}

.pagination-dots {
  padding: 0 0.25rem;
  color: #9ca3af;
  font-size: 0.8125rem;
}

.perpage-select {
  padding: 0.25rem 0.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  color: #374151;
  background: #fff;
  outline: none;
  cursor: pointer;
}

.perpage-select:focus {
  border-color: #f0a500;
  box-shadow: 0 0 0 2px rgba(240, 165, 0, 0.1);
}

.pagination-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  height: 2rem;
  padding: 0 0.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  color: #4b5563;
  background: #fff;
  cursor: pointer;
  transition: all 0.15s;
}

.pagination-btn:hover:not(:disabled) {
  background: #f9fafb;
  border-color: #d1d5db;
}

.pagination-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pagination-btn-active {
  background: #1a1a1a;
  color: #fff;
  border-color: #1a1a1a;
}

.pagination-btn-active:hover {
  background: #333;
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
  max-width: 42rem;
  max-height: 90vh;
  overflow-y: auto;
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

.editor-placeholder {
  min-height: 160px;
  border: 1px dashed #d1d5db;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  background: #f9fafb;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.875rem;
  color: #4b5563;
}

.radio-input {
  accent-color: #f0a500;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
  color: #4b5563;
}

.checkbox-input {
  accent-color: #f0a500;
  width: 16px;
  height: 16px;
}

/* Type tags */
.type-tag {
  display: inline-block;
  padding: 0.0625rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 500;
  white-space: nowrap;
}

.type-tag-normal {
  background: #dbeafe;
  color: #1d4ed8;
}

.type-tag-highlight {
  background: #fef3c7;
  color: #b45309;
}

.type-tag-slider {
  background: #ede9fe;
  color: #6d28d9;
}

/* Thumbnail upload */
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
  height: 100px;
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

.btn-change-img:hover {
  background: #f3f4f6;
}

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

.btn-remove-img:hover {
  background: #fef2f2;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.75rem;
}

.gallery-card {
  position: relative;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;
  background: #fff;
}

.gallery-img {
  width: 100%;
  height: 110px;
  object-fit: cover;
  display: block;
}

.gallery-remove-btn {
  position: absolute;
  top: 0.375rem;
  right: 0.375rem;
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  border-radius: 9999px;
  background: rgba(17, 24, 39, 0.72);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

/* Catalogue Blocks */
.catalogue-block-card {
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #fff;
  overflow: hidden;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.catalogue-block-card:hover {
  border-color: #f0a500;
  box-shadow: 0 2px 4px rgba(240, 165, 0, 0.1);
}

.catalogue-block-card.drag-over {
  border-color: #f0a500;
  background: #fffbeb;
}

.catalogue-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  gap: 0.75rem;
}

.catalogue-block-header input {
  margin: 0 !important;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
