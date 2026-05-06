<script setup lang="ts">
import { ref, onMounted } from 'vue'
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

interface CategoryGroup {
  id: number;
  name: string;
  slug: string;
  items: NewsItem[];
}

const groupedData = ref<CategoryGroup[]>([])

function getColor(index: number) {
  return defaultColors[index % defaultColors.length]
}

onMounted(async () => {
  try {
    const { data } = await publicApi.get('/public/news/grouped-by-category')
    groupedData.value = data.data || []
  } catch {
    groupedData.value = []
  }
})
</script>

<template>
  <div v-if="groupedData.length" class="mt-6 max-sm:mt-4">
    <div v-for="category in groupedData" :key="category.id" class="mb-8">
      <h2 class="inline-flex items-center gap-2.5 text-lg font-bold text-[#1a3a5c] uppercase bg-transparent p-0 m-0"
        style="padding-top: 5px !important; padding-bottom: 5px !important; line-height: 1;">
        <span class="w-1 h-6 bg-[#f0a500] rounded-sm"></span>
        {{ category.name }}
      </h2>

      <!-- GRID ẢNH:
           - mt-[5px]: tạo đúng 5px khoảng cách từ mép dưới tiêu đề xuống ảnh -->
      <div class="grid grid-cols-5 gap-x-3.5 gap-y-5 max-lg:grid-cols-3 max-sm:grid-cols-2 mt-1.25">
        <router-link v-for="(news, index) in category.items" :key="news.id" :to="getArticleRoute(news)"
          class="bg-white rounded-md overflow-hidden shadow-sm cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-lg block relative h-40 max-sm:h-32">

          <!-- Nội dung Card (Ảnh + Overlay + Tiêu đề trắng) -->
          <div class="absolute inset-0 bg-cover bg-center z-0"
            :style="{ backgroundImage: `url('${getArticleCoverImage(news)}')`, backgroundColor: getColor(index) }">
          </div>
          <div class="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent z-10"></div>
          <div class="absolute bottom-0 left-0 right-0 p-2.5 z-20">
            <p class="text-xs font-semibold text-white leading-tight line-clamp-2 text-center drop-shadow-md">
              {{ news.title }}
            </p>
          </div>
        </router-link>
      </div>

    </div>
  </div>
</template>

<style scoped>
.view-all-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #1a3a5c;
  border: 1px solid #1a3a5c;
  border-radius: 9999px;
  transition: all 0.2s;
}

.view-all-btn:hover {
  background-color: #15803d;
  color: #f0a500;
  border-color: #15803d;
}
</style>
