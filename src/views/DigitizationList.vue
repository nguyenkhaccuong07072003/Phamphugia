<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { publicApi } from '../api'

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

const router = useRouter()
const templates = ref<Template[]>([])
const loading = ref(false)
const selectedCategory = ref('')

async function fetchTemplates() {
  loading.value = true
  try {
    const params: Record<string, string | number> = { limit: 100 }
    if (selectedCategory.value) params.category = selectedCategory.value
    const { data } = await publicApi.get('/public/digitization/templates', { params })
    templates.value = data.data || []
  } catch (e) {
    console.error('Failed to fetch templates:', e)
  } finally {
    loading.value = false
  }
}

const categories = computed(() => {
  const cats = new Set(templates.value.map(t => t.category).filter(Boolean))
  return Array.from(cats) as string[]
})

function openTemplate(slug: string) {
  router.push({ name: 'digitization-form', params: { slug } })
}

function getTypeLabel(type: string) {
  return type === 'docx' ? 'Word' : 'Excel'
}

function getTypeColor(type: string) {
  return type === 'docx'
    ? 'background: #dbeafe; color: #1d4ed8'
    : 'background: #d1fae5; color: #047857'
}

onMounted(fetchTemplates)
</script>

<template>
  <div class="w-full py-10 px-10 max-sm:px-3 max-sm:py-4">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold" style="color: #1a3a5c">S&#7889; h&#243;a d&#7919; li&#7879;u</h1>
      <p class="text-gray-500 mt-1">Ch&#7885;n m&#7851;u bi&#7875;u &#273;&#7875; b&#7855;t &#273;&#7847;u &#273;i&#7873;n th&#244;ng tin</p>
    </div>

    <!-- Category filter -->
    <div v-if="categories.length > 0" class="mb-6 flex flex-wrap gap-2">
      <button
        class="category-btn"
        :class="{ 'category-btn-active': selectedCategory === '' }"
        @click="selectedCategory = ''; fetchTemplates()"
      >
        T&#7845;t c&#7843;
      </button>
      <button
        v-for="cat in categories"
        :key="cat"
        class="category-btn"
        :class="{ 'category-btn-active': selectedCategory === cat }"
        @click="selectedCategory = cat; fetchTemplates()"
      >
        {{ cat }}
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="text-gray-400">&#272;ang t&#7843;i...</div>
    </div>

    <!-- Template grid -->
    <div v-else-if="templates.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div
        v-for="item in templates"
        :key="item.id"
        class="template-card"
        @click="openTemplate(item.slug)"
      >
        <div class="template-icon">
          <span class="material-icon">{{ item.icon || 'description' }}</span>
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="template-name">{{ item.name }}</h3>
          <p v-if="item.description" class="template-desc">{{ item.description }}</p>
          <div class="flex items-center gap-2 mt-3">
            <span class="type-badge" :style="getTypeColor(item.template_type)">
              {{ getTypeLabel(item.template_type) }}
            </span>
            <span v-if="item.category" class="category-badge">{{ item.category }}</span>
          </div>
        </div>
        <div class="template-arrow">
          <span class="material-icon">chevron_right</span>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="text-center py-20">
      <span class="material-icon text-5xl text-gray-300">folder_open</span>
      <p class="text-gray-400 mt-3">Ch&#432;a c&#243; m&#7851;u bi&#7875;u n&#224;o</p>
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

.category-btn {
  padding: 0.375rem 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 9999px;
  font-size: 0.875rem;
  color: #6b7280;
  background: #fff;
  cursor: pointer;
  transition: all 0.15s;
}

.category-btn:hover {
  border-color: #f0a500;
  color: #f0a500;
}

.category-btn-active {
  background: #1a3a5c;
  color: #fff;
  border-color: #1a3a5c;
}

.template-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.template-card:hover {
  border-color: #f0a500;
  box-shadow: 0 4px 12px rgba(240, 165, 0, 0.12);
  transform: translateY(-2px);
}

.template-icon {
  width: 48px;
  height: 48px;
  border-radius: 0.75rem;
  background: #f0f9ff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.template-icon .material-icon {
  font-size: 24px;
  color: #1a3a5c;
}

.template-name {
  font-weight: 600;
  font-size: 0.9375rem;
  color: #1f2937;
  line-height: 1.3;
}

.template-desc {
  font-size: 0.8125rem;
  color: #6b7280;
  margin-top: 0.25rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.type-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 500;
}

.category-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 500;
  background: #f3f4f6;
  color: #6b7280;
}

.template-arrow {
  flex-shrink: 0;
  color: #d1d5db;
  transition: color 0.2s;
}

.template-card:hover .template-arrow {
  color: #f0a500;
}
</style>
