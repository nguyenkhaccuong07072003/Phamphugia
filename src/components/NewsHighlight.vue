<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { publicApi } from '../api'
import { getArticleCoverImage, getArticleRoute, type ArticleCategory } from '../utils/article'

const defaultColors = ['#d4573b', '#3b7dd4', '#3bd46b', '#d4a73b']

interface HighlightItem {
  id: number
  title: string
  slug: string
  thumbnail_url: string | null
  image_urls?: string[] | null
  published_at: string
  category?: ArticleCategory | null
}

const highlightNews = ref<HighlightItem[]>([])

function getColor(index: number) {
  return defaultColors[index % defaultColors.length]
}

onMounted(async () => {
  try {
    const { data } = await publicApi.get('/public/news/highlight')
    highlightNews.value = data.data || []
  } catch {
    highlightNews.value = []
  }
})
</script>

<template>
  <div class="grid grid-cols-2 grid-rows-2 gap-3 max-sm:gap-2 h-full">
    <router-link
      v-for="(news, index) in highlightNews"
      :key="news.id"
      :to="getArticleRoute(news)"
      class="highlight-card rounded-md overflow-hidden shadow-sm cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg bg-cover bg-center flex items-center justify-center"
      :style="getArticleCoverImage(news)
        ? { backgroundImage: `url(${getArticleCoverImage(news)})` }
        : { backgroundColor: getColor(index) }"
    >
      <span v-if="!getArticleCoverImage(news)" class="text-6xl max-sm:text-3xl">📰</span>
    </router-link>
  </div>
</template>

<style scoped>
.highlight-card {
  min-height: 0;
}
</style>
