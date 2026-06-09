<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { publicApi } from '../api'
import { type ArticleCategory } from '../utils/article'

interface CatalogueBlock {
  id: string
  title: string
  image: string | null
  specifications: string
}

interface Article {
  id: number
  title: string
  slug: string
  content: string | null
  specifications?: string | null
  catalogue_blocks?: CatalogueBlock[] | null
  thumbnail_url: string | null
  image_urls?: string[] | null
  view_count: number
  published_at: string
  category: ArticleCategory | null
  author: { id: number; full_name: string; avatar_url: string | null } | null
  department: { id: number; name: string } | null
}

interface RelatedItem {
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
const article = ref<Article | null>(null)
const relatedNews = ref<RelatedItem[]>([])
const loading = ref(true)
const error = ref(false)
const selectedGalleryImage = ref<string | null>(null)

const hasCatalogueBlocks = computed(() =>
  Array.isArray(article.value?.catalogue_blocks) && article.value.catalogue_blocks.length > 0
)
const galleryImages = computed(() => {
  if (!article.value) return []
  const rawImages = [
    article.value.thumbnail_url,
    ...(Array.isArray(article.value.image_urls) ? article.value.image_urls : []),
  ].filter((url): url is string => typeof url === 'string' && url.length > 0)

  return Array.from(new Set(rawImages))
})


async function loadArticle(slug: string) {
  loading.value = true
  error.value = false
  selectedGalleryImage.value = null

  try {
    const { data } = await publicApi.get(`/public/news/${slug}`)
    article.value = data.data
    selectedGalleryImage.value = galleryImages.value[0] || null
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }

  try {
    const { data } = await publicApi.get(`/public/news/related/${slug}`)
    relatedNews.value = data.data || []
  } catch {
    relatedNews.value = []
  }
}

onMounted(() => loadArticle(route.params.slug as string))

watch(() => route.params.slug, (newSlug) => {
  if (newSlug) {
    window.scrollTo(0, 0)
    loadArticle(newSlug as string)
  }
})
</script>

<template>
  <div class="w-full py-10 px-10 max-sm:px-3 max-sm:py-4" style="padding-left: 45px">
    <div v-if="loading" class="flex justify-center py-20">
      <p class="text-gray-400">Đang tải...</p>
    </div>

    <div v-else-if="error || !article" class="text-center py-20">
      <p class="text-gray-500 text-lg mb-4">Không tìm thấy nội dung</p>
      <button class="text-[#1a3a5c] font-medium hover:underline" @click="router.push('/')">Quay về trang chủ</button>
    </div>

    <div v-else>
      <button
        class="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1a3a5c] mb-5 max-sm:mb-3 transition-colors"
        @click="router.back()">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Quay lại
      </button>


      <div class="flex gap-8 max-lg:flex-col">
        <div class="flex-1 min-w-0">
          <h1 class="text-[22px] font-bold text-[#1a3a5c] leading-snug mb-4">
            {{ article.title }}
          </h1>

          <!-- <div class="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-6 max-sm:mb-4">
            <span v-if="article.author && !isProduct" class="flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              {{ article.author.full_name }}
            </span>
            <span v-if="article.published_at" class="flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              {{ formatDate(article.published_at) }}
            </span>
            <span class="flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              {{ article.view_count }} lượt xem
            </span>
          </div> -->

          <!-- Catalogue Blocks (Product Listing with 2/3 + 1/3 layout) -->
          <div v-if="hasCatalogueBlocks" class="mt-5 mb-8 flex flex-col gap-7.5">
            <section v-for="(block, index) in article.catalogue_blocks" :key="index"
              class="grid grid-cols-1 lg:grid-cols-3 gap-2.5 items-start">
              <!-- Left (2/3): Image with title overlay -->
              <div
                class="lg:col-span-2 relative group overflow-hidden rounded-xl bg-gray-100 shadow-sm border border-gray-100">
                <img :src="block.image || ''" :alt="block.title"
                  class="w-full h-auto max-h-150 object-cover object-center" v-if="block.image" />
                <div v-else class="w-full h-100 bg-gray-200 flex items-center justify-center">
                  <span class="text-gray-400 text-sm">Không có ảnh</span>
                </div>

                <!-- Title overlay -->
                <div class="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-6 pt-16">
                  <h2 class="text-2xl md:text-3xl font-bold text-white tracking-wide text-center">
                    {{ block.title }}
                  </h2>
                </div>
              </div>

              <!-- Right (1/3): Specifications panel -->
              <div
                class="lg:col-span-1 bg-gray-50 rounded-xl border border-gray-200 h-full flex flex-col overflow-hidden">
                <h3
                  class="text-lg font-bold text-gray-900 py-4 uppercase tracking-wider border-b border-gray-200 text-center bg-white/50">
                  Thông số kỹ thuật
                </h3>

                <div class="p-6 flex-1 bg-gray-50 overflow-x-auto">
                  <div v-html="article.specifications?.trim() || block.specifications?.trim()"></div>
                </div>
              </div>
            </section>
          </div>

          <!-- Regular content (for non-catalogue articles) -->
          <template v-if="!hasCatalogueBlocks">
            <div v-if="article.content" class="prose prose-lg max-w-none text-gray-700 leading-loose"
              v-html="article.content"></div>
          </template>

          <div v-if="article.department" class="mt-8 pt-4 border-t border-gray-200 text-sm text-gray-500">
            {{ article.department.name }}
          </div>
        </div>

        <!-- <div v-if="relatedNews.length" class="w-72 max-lg:w-full shrink-0">
          <h3 class="flex items-center gap-2 text-base font-bold text-[#1a3a5c] mb-4 uppercase">
            <span class="w-1 h-5 bg-[#f0a500] rounded-sm"></span>
            {{ relatedTitle }}
          </h3>
          <div class="flex flex-col gap-3 max-lg:grid max-lg:grid-cols-2 max-sm:grid-cols-1">
            <router-link v-for="news in relatedNews" :key="news.id" :to="getArticleRoute(news)"
              class="flex gap-3 group">
              <div class="w-20 h-14 shrink-0 rounded overflow-hidden bg-gray-100 bg-cover bg-center" :style="getArticleCoverImage(news)
                ? { backgroundImage: `url(${getArticleCoverImage(news)})` }
                : { backgroundColor: '#1a3a5c' }">
                <span v-if="!getArticleCoverImage(news)"
                  class="flex items-center justify-center h-full text-lg">📰</span>
              </div>
              <div class="flex-1 min-w-0">
                <p
                  class="text-sm font-medium text-gray-700 leading-tight line-clamp-2 group-hover:text-[#1a3a5c] transition-colors">
                  {{ news.title }}
                </p>
                <span class="text-xs text-gray-400 mt-1 block">{{ formatDate(news.published_at) }}</span>
              </div>
            </router-link>
          </div>
        </div> -->
      </div>
    </div>
  </div>
</template>

<style scoped>
.product-hero {
  overflow: hidden;
  border-radius: 1rem;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
}

.product-hero-image {
  width: 100%;
  max-height: 480px;
  object-fit: cover;
  display: block;
}

.product-gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
  gap: 0.75rem;
  margin-top: 1rem;
}

.product-gallery-thumb {
  padding: 0;
  border: 2px solid transparent;
  border-radius: 0.875rem;
  overflow: hidden;
  background: #fff;
  cursor: pointer;
}

.product-gallery-thumb-active {
  border-color: #f0a500;
}

.product-gallery-thumb-image {
  width: 100%;
  height: 82px;
  object-fit: cover;
  display: block;
}
</style>
