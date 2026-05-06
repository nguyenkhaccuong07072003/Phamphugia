<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { publicApi } from '../api'

interface BannerData {
  id: number
  title: string
  image_url: string
  is_active: boolean
}

const banner = ref<BannerData | null>(null)

onMounted(async () => {
  try {
    const { data } = await publicApi.get('/public/banner')
    banner.value = data.data || null
  } catch {
    banner.value = null
  }
})
</script>

<template>
  <div>
    <!-- Top Info Bar -->
    <div class="w-full bg-[#d4ebdd] text-black h-10 flex items-center max-sm:hidden" style="font-size: 15px">
      <div class="w-full flex items-center justify-between" style="padding-left: 50px; padding-right: 50px">
        <div class="flex items-center gap-4">
          <a href="tel:02812345670" class="flex items-center gap-1.5 hover:text-[#f0a500] transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            <span>028 1234 5670</span>
          </a>
          <a href="mailto:info@phamphugia.vn" class="flex items-center gap-1.5 hover:text-[#f0a500] transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="20" height="16" x="2" y="4" rx="2"/>
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
            <span>info@phamphugia.vn</span>
          </a>
        </div>
        <div class="flex items-center gap-4">
          <a href="https://facebook.com/phamphugia" target="_blank" class="flex items-center gap-1.5 hover:text-[#f0a500] transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            <span>Facebook</span>
          </a>
          <a href="https://zalo.me/phamphugia" target="_blank" class="flex items-center gap-1.5 hover:text-[#f0a500] transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 48 48" fill="currentColor">
              <path d="M24 4C12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20S35.046 4 24 4zm-5.5 28.5c-.828 0-1.5-.672-1.5-1.5v-8.25l-2.25 2.25c-.586.586-1.536.586-2.121 0s-.586-1.535 0-2.121l4.5-4.5a1.5 1.5 0 0 1 2.121 0l.75.75V31c0 .828-.672 1.5-1.5 1.5zm14.5-3c0 1.657-1.343 3-3 3h-4c-1.657 0-3-1.343-3-3v-4c0-1.657 1.343-3 3-3h4c1.657 0 3 1.343 3 3v4zm-3-4h-4v4h4v-4z"/>
            </svg>
            <span>Zalo</span>
          </a>
        </div>
      </div>
    </div>

    <!-- Banner: show image if available, fallback to text -->
    <div v-if="banner && banner.image_url" class="w-full overflow-hidden h-50 max-sm:h-20">
      <img
        :src="banner.image_url"
        :alt="banner.title"
        class="w-full h-full object-cover"
      />
    </div>
    <div v-else class="w-full bg-linear-to-br from-[#0d2137] via-[#1a4a7a] to-[#0d2137] h-40 max-sm:h-20 flex items-center justify-center">
      <span class="text-5xl max-sm:text-2xl font-extrabold text-[#f0a500] tracking-[8px] max-sm:tracking-[4px] drop-shadow-lg">phamphugia</span>
    </div>
  </div>
</template>
