<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  publicDepartments as departments,
  publicCompanies as companies,
  ensurePublicOrgLoaded,
} from '../composables/useOrgLists'

const openDropdown = ref<number | null>(null)

onMounted(() => {
  void ensurePublicOrgLoaded()
})

// Ngắt tên thành 2 dòng tại khoảng trắng gần giữa nhất
function splitName(name: string): { line1: string; line2: string } | null {
  const words = name.split(' ')
  if (words.length <= 1) return null

  const mid = name.length / 2
  let bestPos = -1
  let bestDist = Infinity

  let pos = 0
  for (let i = 0; i < words.length - 1; i++) {
    pos += words[i]!.length
    const dist = Math.abs(pos + i - mid)
    if (dist < bestDist) {
      bestDist = dist
      bestPos = i
    }
  }

  return {
    line1: words.slice(0, bestPos + 1).join(' '),
    line2: words.slice(bestPos + 1).join(' '),
  }
}
</script>

<template>
  <nav class="w-full bg-white border-b-[3px] border-[#f0a500] sticky top-0 z-50 shadow-sm max-sm:hidden"
    style="margin-bottom: 10px">
    <div class="w-full px-8 py-1">
      <ul class="flex flex-nowrap justify-center gap-0">
        <li>
          <router-link
            to="/"
            class="topbar-item flex items-center justify-center w-16 h-16 transition-all duration-300"
            active-class=""
            exact-active-class=""
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
          </router-link>
        </li>
        <li v-for="dept in departments" :key="dept.id" class="relative" @mouseenter="openDropdown = dept.id"
          @mouseleave="openDropdown = null">
          <div
            class="topbar-item flex items-center justify-center px-5 h-16 text-[14px] font-semibold text-center leading-snug transition-all duration-300 cursor-pointer"
            :class="{ 'is-active': openDropdown === dept.id }">
            <span class="topbar-item-text">
              <template v-if="splitName(dept.name)">
                {{ splitName(dept.name)!.line1 }}<br>{{ splitName(dept.name)!.line2 }}
              </template>
              <template v-else>
                {{ dept.name }}
              </template>
            </span>
          </div>

          <!-- Dropdown công ty -->
          <div v-show="openDropdown === dept.id"
            class="absolute top-full left-0 bg-white shadow-lg z-40 min-w-[180px] mt-[10px] divide-y divide-gray-100">
            <router-link v-for="company in companies" :key="company.id"
              :to="`/department/${dept.slug}?company=${company.slug}`"
              class="company-item block text-sm text-gray-700 transition-colors duration-200">
              {{ company.name }}
            </router-link>
          </div>
        </li>
        <li>
          <router-link
            to="/chat"
            class="topbar-item flex items-center justify-center px-5 h-16 text-[14px] font-semibold transition-all duration-300"
            active-class=""
            exact-active-class=""
            aria-label="Chatbot AI"
          >
            <span class="topbar-item-text">Chatbot</span>
          </router-link>
        </li>
      </ul>
    </div>
  </nav>
</template>

<style scoped>
.topbar-item {
  color: #1a3a5c;
  flex-shrink: 0;
  padding-left: 10px;
  padding-right: 10px;
}

.topbar-item:hover,
.topbar-item.is-active {
  background-color: #15803d;
  color: #f0a500;
}

.topbar-item-text {
  display: block;
  text-align: center;
  line-height: 1.35;
  white-space: nowrap;
}

.company-item {
  color: #374151;
  padding: 10px 10px;
}

.company-item:hover {
  background-color: #15803d;
  color: #f0a500;
}
</style>
