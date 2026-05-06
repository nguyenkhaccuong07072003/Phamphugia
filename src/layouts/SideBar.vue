<script setup lang="ts">
import { onMounted } from 'vue'
import { sidebarNewsItems as newsList, ensureSidebarNews } from '../composables/useOrgLists'
import { getArticleRoute } from '../utils/article'

const colors = ['#1a3a5c', '#2c5f8a', '#0d4a2f', '#5c1a3a', '#3a5c1a', '#5c3a1a', '#3a1a5c', '#1a5c3a']

function getColor(index: number) {
  return colors[index % colors.length]
}

onMounted(() => {
  void ensureSidebarNews()
})
</script>

<template>
  <aside class="w-full h-full flex flex-col">
    <!-- Danh sách tin tức - chiếm hết chiều cao còn lại -->
    <div class="bg-white rounded-md overflow-hidden shadow-sm max-sm:shadow-none max-sm:rounded-none max-sm:border-0 flex-1 flex flex-col">
      <h3 class="bg-[#d4ebdd] text-black px-4 py-2.5 text-sm max-sm:text-base font-semibold uppercase tracking-wide shrink-0" style="padding-left: 10px">
        Tin tức mới nhất
      </h3>
      <!-- Desktop: list nhỏ gọn -->
      <ul class="py-1 flex-1 overflow-y-auto max-sm:hidden">
        <li v-for="(news, index) in newsList" :key="news.id">
          <router-link :to="getArticleRoute(news)" class="sidebar-item flex items-start gap-2 py-2.5 text-[14px]" style="padding-left: 12px; padding-right: 12px">
            <span class="text-[#f0a500] font-bold text-[14px] shrink-0">{{ String(index + 1).padStart(2, '0') }}.</span>
            <span class="line-clamp-1 leading-relaxed">{{ news.title }}</span>
          </router-link>
        </li>
      </ul>
      <!-- Mobile: card lớn kiểu YouTube -->
      <div class="hidden max-sm:block px-3 py-2">
        <router-link
          v-for="(news, index) in newsList"
          :key="'m-' + news.id"
          :to="getArticleRoute(news)"
          class="mobile-news-card block overflow-hidden"
          :style="{ backgroundColor: getColor(index), marginBottom: '20px', textDecoration: 'none', border: 'none', boxShadow: 'none' }"
        >
          <!-- Thumbnail placeholder -->
          <div class="w-full h-48 flex items-center justify-center" :style="{ backgroundColor: getColor(index) }">
            <span class="text-white/40 text-5xl">&#128240;</span>
          </div>
          <!-- Info -->
          <div class="bg-white p-4" style="border: none">
            <p class="text-lg font-semibold text-[#1a3a5c] leading-snug text-center" style="border: none">{{ news.title }}</p>
          </div>
        </router-link>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar-item {
  color: #4b5563;
  transition: background-color 0.2s, color 0.2s, padding-left 0.2s;
}
.sidebar-item:hover,
.sidebar-item.router-link-active {
  background-color: #15803d;
  color: #f0a500;
  padding-left: 15px !important;
}
.sidebar-item:hover span,
.sidebar-item.router-link-active span {
  color: #f0a500;
}
.mobile-news-card,
.mobile-news-card * {
  border: none !important;
  outline: none !important;
  box-shadow: none !important;
  text-decoration: none !important;
}
</style>
