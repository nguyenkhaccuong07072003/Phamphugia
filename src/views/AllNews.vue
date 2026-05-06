<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { publicApi } from '../api'
import { getArticleCoverImage, getArticleRoute, type ArticleCategory } from '../utils/article'

const defaultColors = ['#1a3a5c', '#2c5f8a', '#0d4a2f', '#5c1a3a', '#3a5c1a', '#5c3a1a', '#3a1a5c', '#1a5c3a']

interface NewsItem {
  id: number
  title: string
  slug: string
  thumbnail_url: string | null
  image_urls?: string[] | null
  published_at: string
  category?: ArticleCategory | null
}

const route = useRoute()
const router = useRouter()
const newsList = ref<NewsItem[]>([])
const loading = ref(true)
const currentPage = ref(1)
const totalPages = ref(1)
const totalItems = ref(0)

function getColor(index: number) {
  return defaultColors[index % defaultColors.length]
}

async function fetchNews(page: number) {
  loading.value = true
  try {
    const { data } = await publicApi.get(`/public/news/all?page=${page}&limit=20`)
    const result = data.data
    newsList.value = result.items || []
    currentPage.value = result.page
    totalPages.value = result.totalPages
    totalItems.value = result.totalItems
  } catch {
    newsList.value = []
  } finally {
    loading.value = false
  }
}

function goToPage(page: number) {
  if (page < 1 || page > totalPages.value) return
  router.push({ query: { page: String(page) } })
}

onMounted(() => {
  const page = parseInt(route.query.page as string) || 1
  fetchNews(page)
})

watch(() => route.query.page, (newPage) => {
  const page = parseInt(newPage as string) || 1
  window.scrollTo(0, 0)
  fetchNews(page)
})
</script>

<template>
  <div class="w-full py-8 px-8 max-sm:px-3 max-sm:py-4">
    <h1 class="flex items-center gap-2.5 text-xl max-sm:text-lg font-bold text-[#1a3a5c] mb-6 max-sm:mb-4 uppercase">
      <span class="w-1 h-7 max-sm:h-5 bg-[#f0a500] rounded-sm"></span>
      Tất cả tin tức
    </h1>

    <div v-if="loading" class="text-center text-gray-400 py-20">Đang tải...</div>

    <div v-else-if="newsList.length === 0" class="text-center py-20">
      <p class="text-gray-500">Chưa có tin tức nào</p>
    </div>

    <div v-else>
      <div
        class="grid grid-cols-5 gap-x-3.5 gap-y-6 max-lg:grid-cols-3 max-sm:grid-cols-2 max-sm:gap-x-2.5 max-sm:gap-y-4">
        <router-link v-for="(news, index) in newsList" :key="news.id" :to="getArticleRoute(news)"
          class="relative bg-white rounded-md overflow-hidden shadow-sm cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg block group h-40 max-sm:h-32">

          <!-- 1. Ảnh nền (đã cho to ra chiếm toàn bộ card) -->
          <div
            class="absolute inset-0 flex items-center justify-center bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
            :style="getArticleCoverImage(news)
              ? { backgroundImage: `url(${getArticleCoverImage(news)})` }
              : { backgroundColor: getColor(index) }">
            <span v-if="!getArticleCoverImage(news)" class="text-4xl max-sm:text-2xl opacity-40">📰</span>
          </div>

          <!-- 2. Lớp phủ đen mờ để làm nổi chữ trắng (Cực kỳ quan trọng) -->
          <div class="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent"></div>

          <!-- 3. Tiêu đề: Đã cho vào trong, nằm dưới, căn giữa, chữ trắng -->
          <div class="absolute bottom-0 left-0 right-0 p-2.5">
            <p
              class="text-[11px] max-sm:text-[10px] font-bold text-white leading-tight line-clamp-2 text-center drop-shadow-lg uppercase">
              {{ news.title }}
            </p>
          </div>
        </router-link>
      </div>

      <div v-if="totalPages > 1" class="flex items-center justify-center gap-3" style="margin-top: 20px">
        <button class="pagination-btn" :disabled="currentPage <= 1" @click="goToPage(currentPage - 1)">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <template v-for="p in totalPages" :key="p">
          <button v-if="p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2)"
            class="pagination-btn" :class="{ active: p === currentPage }" @click="goToPage(p)">
            {{ p }}
          </button>
          <span v-else-if="p === currentPage - 3 || p === currentPage + 3" class="text-gray-400 text-sm px-1">...</span>
        </template>
        <button class="pagination-btn" :disabled="currentPage >= totalPages" @click="goToPage(currentPage + 1)">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pagination-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  height: 2rem;
  padding: 0 0.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: #374151;
  background: #fff;
  cursor: pointer;
  transition: all 0.15s;
}

.pagination-btn:hover:not(:disabled):not(.active) {
  background: #f3f4f6;
}

.pagination-btn.active {
  background: #1a3a5c;
  color: #fff;
  border-color: #1a3a5c;
}

.pagination-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
