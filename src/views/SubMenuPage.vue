<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { publicApi } from '../api'

interface Department {
  id: number
  name: string
  slug: string
}

interface PageData {
  id: number
  label: string
  slug: string
  content: string | null
  department: Department | null
}

const route = useRoute()
const page = ref<PageData | null>(null)
const loading = ref(true)
const error = ref(false)

async function fetchPage() {
  loading.value = true
  error.value = false
  try {
    const deptSlug = route.params.deptSlug as string | undefined
    const slug = route.params.slug as string
    const url = deptSlug
      ? `/public/pages/${deptSlug}/${slug}`
      : `/public/pages/${slug}`
    const { data } = await publicApi.get(url)
    page.value = data.data
  } catch {
    page.value = null
    error.value = true
  } finally {
    loading.value = false
  }
}

onMounted(fetchPage)
watch(() => [route.params.deptSlug, route.params.slug], fetchPage)
</script>

<template>
  <div class="w-full py-10 px-10 max-sm:px-3 max-sm:py-4">
    <div v-if="loading" class="text-center text-gray-400 py-20">Đang tải...</div>
    <div v-else-if="error || !page" class="text-center py-20">
      <p class="text-gray-500 text-lg">Không tìm thấy trang</p>
      <router-link to="/" class="text-blue-500 text-sm mt-2 inline-block">Về trang chủ</router-link>
    </div>
    <div v-else>
      <!-- Breadcrumb -->
      <div class="breadcrumb">
        <router-link to="/" class="breadcrumb-link">Trang chủ</router-link>
        <span class="breadcrumb-sep">/</span>
        <router-link
          v-if="page.department"
          :to="`/department/${page.department.slug}`"
          class="breadcrumb-link"
        >
          {{ page.department.name }}
        </router-link>
        <span v-if="page.department" class="breadcrumb-sep">/</span>
        <span class="breadcrumb-current">{{ page.label }}</span>
      </div>

      <!-- Page header -->
      <div class="page-header">
        <h1 class="page-title">{{ page.label }}</h1>
      </div>

      <!-- Content -->
      <div v-if="page.content" class="page-content" v-html="page.content"></div>
      <div v-else class="empty-content">
        <p>Nội dung đang được cập nhật...</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
}

.breadcrumb-link {
  color: #3b82f6;
  text-decoration: none;
  transition: color 0.2s;
}

.breadcrumb-link:hover {
  color: #1d4ed8;
  text-decoration: underline;
}

.breadcrumb-sep {
  color: #9ca3af;
}

.breadcrumb-current {
  color: #6b7280;
}

.page-header {
  padding: 1.5rem;
  background: linear-gradient(135deg, #f0f9ff, #ecfdf5);
  border-radius: 0.75rem;
  border: 1px solid #e0f2fe;
  margin-bottom: 2rem;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1a3a5c;
}

.page-content {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  padding: 2rem;
  line-height: 1.8;
  color: #374151;
  font-size: 0.95rem;
}

.page-content :deep(h1),
.page-content :deep(h2),
.page-content :deep(h3) {
  color: #1a3a5c;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
  font-weight: 600;
}

.page-content :deep(h1) { font-size: 1.5rem; }
.page-content :deep(h2) { font-size: 1.25rem; }
.page-content :deep(h3) { font-size: 1.1rem; }

.page-content :deep(p) {
  margin-bottom: 1rem;
}

.page-content :deep(ul),
.page-content :deep(ol) {
  margin-bottom: 1rem;
  padding-left: 1.5rem;
}

.page-content :deep(li) {
  margin-bottom: 0.25rem;
}

.page-content :deep(a) {
  color: #3b82f6;
  text-decoration: underline;
}

.page-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
  margin: 1rem 0;
}

.page-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}

.page-content :deep(th),
.page-content :deep(td) {
  border: 1px solid #e5e7eb;
  padding: 0.5rem 0.75rem;
  text-align: left;
}

.page-content :deep(th) {
  background: #f9fafb;
  font-weight: 600;
}

.page-content :deep(blockquote) {
  border-left: 4px solid #f0a500;
  padding-left: 1rem;
  margin: 1rem 0;
  color: #6b7280;
  font-style: italic;
}

.empty-content {
  text-align: center;
  padding: 4rem 2rem;
  color: #9ca3af;
  background: #f9fafb;
  border-radius: 0.75rem;
  border: 1px dashed #d1d5db;
}
</style>
