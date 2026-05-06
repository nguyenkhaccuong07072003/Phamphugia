<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { publicApi } from '../api'
import { getArticleCoverImage, getArticleRoute, type ArticleCategory } from '../utils/article'

interface SlideItem {
  id: number
  title: string
  slug: string
  thumbnail_url: string | null
  image_urls?: string[] | null
  slider_sort_order: number
  published_at: string
  category?: ArticleCategory | null
}

const router = useRouter()
const slides = ref<SlideItem[]>([])
const currentIndex = ref(0)
let interval: ReturnType<typeof setInterval> | null = null

const hasSlides = computed(() => slides.value.length > 0)

function nextSlide() {
  if (!hasSlides.value) return
  currentIndex.value = (currentIndex.value + 1) % slides.value.length
}

function prevSlide() {
  if (!hasSlides.value) return
  currentIndex.value = (currentIndex.value - 1 + slides.value.length) % slides.value.length
}

function goToArticle(slide: SlideItem) {
  router.push(getArticleRoute(slide))
}

function startAutoSlide() {
  if (slides.value.length > 1) {
    interval = setInterval(nextSlide, 4000)
  }
}

function stopAutoSlide() {
  if (interval) {
    clearInterval(interval)
    interval = null
  }
}

onMounted(async () => {
  try {
    const { data } = await publicApi.get('/public/slides')
    slides.value = data.data || []
  } catch {
    slides.value = []
  }
  startAutoSlide()
})

onUnmounted(() => {
  stopAutoSlide()
})
</script>

<template>
  <div
    class="group relative w-full rounded-md overflow-hidden shadow-lg slider-container"
    @mouseenter="stopAutoSlide"
    @mouseleave="startAutoSlide"
  >
    <div v-if="hasSlides" class="overflow-hidden h-full">
      <div
        class="flex h-full transition-transform duration-500 ease-in-out"
        :style="{ transform: `translateX(-${currentIndex * 100}%)` }"
      >
        <div
          v-for="slide in slides"
          :key="slide.id"
          class="slide-item cursor-pointer"
          style="background-color: #1a3a5c"
          @click="goToArticle(slide)"
        >
          <img
            v-if="getArticleCoverImage(slide)"
            :src="getArticleCoverImage(slide)!"
            :alt="slide.title"
            class="slide-img"
          />
          <div class="slide-title-overlay">
            <p class="text-white text-lg max-sm:text-sm font-semibold drop-shadow-lg text-center line-clamp-1">{{ slide.title }}</p>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="h-full flex items-center justify-center bg-gray-100">
      <p class="text-gray-400 text-sm">Chưa có slide nào</p>
    </div>

    <template v-if="slides.length > 1">
      <button
        class="slider-arrow left-0 rounded-r-md pl-2 pr-3"
        @click.stop="prevSlide"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 max-sm:w-4 max-sm:h-4"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <button
        class="slider-arrow right-0 rounded-l-md pr-2 pl-3"
        @click.stop="nextSlide"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 max-sm:w-4 max-sm:h-4"><polyline points="9 6 15 12 9 18"/></svg>
      </button>
    </template>
  </div>
</template>

<style scoped>
.slider-container {
  aspect-ratio: 20 / 9;
  max-height: 400px;
}

.slide-item {
  min-width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.slide-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
}

.slide-title-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.7), transparent);
  padding: 1rem;
}

@media (max-width: 640px) {
  .slide-title-overlay {
    padding: 0.625rem;
  }
}

.slider-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
  color: white;
  border: none;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s ease;
}

.group:hover .slider-arrow {
  opacity: 1;
}

.slider-arrow:hover {
  background: rgba(0, 0, 0, 0.6);
}

@media (max-width: 640px) {
  .slider-arrow {
    height: 44px;
  }
}
</style>
