<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import BannerHeader from './layouts/BannerHeader.vue'
import TopBar from './layouts/TopBar.vue'
import FooterSection from './layouts/FooterSection.vue'
import SideBar from './layouts/SideBar.vue'

const route = useRoute()
const isAdminRoute = computed(() => route.path.startsWith('/admin'))
const showMobileChatLink = computed(() => route.path !== '/chat')
</script>

<template>
  <!-- Admin pages render their own layout -->
  <router-view v-if="isAdminRoute" />

  <!-- Public layout -->
  <div v-else class="min-h-screen w-full bg-[#f0f2f5]">
    <router-link
      v-if="showMobileChatLink"
      to="/chat"
      class="no-print-chrome fixed bottom-5 right-4 z-55 hidden h-14 items-center justify-center rounded-full bg-[#15803d] px-5 text-sm font-semibold text-[#f0a500] shadow-lg transition hover:bg-[#166534] max-sm:flex"
      aria-label="Chatbot AI"
    >
      Chatbot
    </router-link>
    <BannerHeader class="no-print-chrome" />
    <TopBar class="no-print-chrome" />
    <!-- Mobile: Sidebar + Footer -->
    <div class="hidden max-sm:block">
      <SideBar class="mobile-sidebar no-print-chrome" />
      <FooterSection class="no-print-chrome" />
    </div>

    <!-- Desktop: Layout bình thường -->
    <div class="flex max-sm:hidden" style="padding-left: 5px; gap: 5px">
      <!-- Sidebar bên trái, sticky dưới topbar, chiếm trọn chiều cao viewport -->
      <div class="w-54 shrink-0 sticky z-40 no-print-chrome" style="top: 75px; height: calc(100vh - 75px)">
        <SideBar />
      </div>

      <!-- Phần bên phải: Content + Footer -->
      <div class="flex-1 min-w-0 flex flex-col" style="margin-right: 5px">
        <main class="flex-1 w-full">
          <router-view />
        </main>
        <FooterSection class="no-print-chrome" />
      </div>
    </div>
  </div>
</template>
