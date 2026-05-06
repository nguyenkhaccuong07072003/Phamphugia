<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const vClickOutside = {
  mounted(el: HTMLElement, binding: { value: () => void }) {
    (el as any)._clickOutside = (e: Event) => {
      if (!el.contains(e.target as Node)) binding.value()
    }
    document.addEventListener('click', (el as any)._clickOutside)
  },
  unmounted(el: HTMLElement) {
    document.removeEventListener('click', (el as any)._clickOutside)
  },
}

const router = useRouter()
const route = useRoute()
const sidebarCollapsed = ref(false)
const userMenuOpen = ref(false)

function toggleUserMenu() {
  userMenuOpen.value = !userMenuOpen.value
}

function closeUserMenu() {
  userMenuOpen.value = false
}

interface NavItem {
  label: string
  icon: string
  route: string
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', route: '/admin' },
  { label: 'Category', icon: 'category', route: '/admin/news-categories' },
  { label: 'Tin tức', icon: 'newspaper', route: '/admin/news' },
  { label: 'Phòng ban', icon: 'account_tree', route: '/admin/departments' },
  { label: 'Công ty', icon: 'business', route: '/admin/companies' },
  { label: 'Số hóa dữ liệu', icon: 'fact_check', route: '/admin/digitization' },
]

const currentRoute = computed(() => route.path)

const currentPageTitle = computed(() => {
  return navItems.find(n => n.route === currentRoute.value)?.label || 'Admin'
})

function navigateTo(path: string) {
  router.push(path)
}

function isActive(path: string) {
  if (path === '/admin') return currentRoute.value === '/admin'
  return currentRoute.value.startsWith(path)
}

function logout() {
  localStorage.removeItem('admin_token')
  localStorage.removeItem('admin_refresh_token')
  router.push('/admin/login')
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Sidebar -->
    <aside class="admin-sidebar" :class="sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'">
      <!-- Logo -->
      <div class="sidebar-logo">
        <div class="logo-icon">
          <span class="text-white font-bold text-xl">M</span>
        </div>
        <span v-if="!sidebarCollapsed" class="logo-text">Admin</span>
      </div>

      <!-- Nav items -->
      <nav class="sidebar-nav">
        <ul class="nav-list">
          <li v-for="item in navItems" :key="item.route">
            <button class="nav-item" :class="isActive(item.route) ? 'nav-item-active' : 'nav-item-default'"
              @click="navigateTo(item.route)" :title="item.label">
              <span class="material-icon text-lg shrink-0">{{ item.icon }}</span>
              <span v-if="!sidebarCollapsed" class="nav-label">{{ item.label }}</span>
            </button>
          </li>
        </ul>
      </nav>

      <!-- Bottom actions -->
      <div class="sidebar-bottom">
        <button class="nav-item nav-item-default" @click="navigateTo('/')" title="Về trang chủ">
          <span class="material-icon text-lg shrink-0">home</span>
          <span v-if="!sidebarCollapsed" class="nav-label">Về trang chủ</span>
        </button>
      </div>
    </aside>

    <!-- Topbar -->
    <header class="admin-topbar" :style="{ left: sidebarCollapsed ? '5rem' : '16rem' }">
      <!-- Left side -->
      <div class="topbar-left">
        <button class="topbar-toggle" @click="sidebarCollapsed = !sidebarCollapsed">
          <span class="material-icon">menu</span>
        </button>
        <div class="topbar-title-group">
          <h1 class="topbar-title">{{ currentPageTitle }}</h1>
          <p class="topbar-subtitle">Hệ thống quản trị nội dung</p>
        </div>
      </div>

      <!-- Right side -->
      <div class="topbar-right">
        <button class="topbar-notification" title="Thông báo">
          <span class="material-icon">notifications</span>
        </button>
        <div class="user-menu-wrapper" v-click-outside="closeUserMenu">
          <button class="topbar-user" @click="toggleUserMenu">
            <div class="user-avatar">A</div>
            <div class="user-info">
              <p class="user-name">Admin</p>
              <p class="user-role">Quản trị viên</p>
            </div>
            <span class="material-icon text-gray-400" style="font-size:16px">expand_more</span>
          </button>
          <div v-if="userMenuOpen" class="user-dropdown">
            <button class="dropdown-item" @click="navigateTo('/admin/profile'); closeUserMenu()">
              <span class="material-icon">person</span>
              Thông tin cá nhân
            </button>
            <button class="dropdown-item" @click="navigateTo('/admin/change-password'); closeUserMenu()">
              <span class="material-icon">lock</span>
              Đổi mật khẩu
            </button>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item dropdown-item-danger" @click="logout">
              <span class="material-icon">logout</span>
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Main content -->
    <main class="admin-main" :style="{ marginLeft: sidebarCollapsed ? '5rem' : '16rem' }">
      <div class="main-content">
        <router-view />
      </div>
    </main>
  </div>
</template>

<style scoped>
.material-icon {
  font-family: 'Material Icons';
  font-weight: normal;
  font-style: normal;
  font-size: 20px;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  display: inline-block;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  -webkit-font-smoothing: antialiased;
}

/* ===== Sidebar ===== */
.admin-sidebar {
  position: fixed;
  left: 0;
  top: 0;
  height: 100%;
  background: #fff;
  border-right: 1px solid #e5e7eb;
  transition: width 0.3s ease;
  z-index: 40;
  display: flex;
  flex-direction: column;
}

.sidebar-expanded {
  width: 16rem;
}

.sidebar-collapsed {
  width: 5rem;
}

/* Logo */
.sidebar-logo {
  height: 4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.logo-icon {
  width: 2.5rem;
  height: 2.5rem;
  background: #f0a500;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.logo-text {
  font-weight: 700;
  font-size: 1.25rem;
  color: #1f2937;
}

/* Nav */
.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 0;
}

.nav-list {
  list-style: none;
  padding: 0 0.75rem;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  border-radius: 0.5rem;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.15s ease;
  background: none;
}

.nav-item-active {
  background: #fff7e6;
  color: #d97706;
}

.nav-item-default {
  color: #4b5563;
}

.nav-item-default:hover {
  background: #f3f4f6;
}

.nav-item-danger {
  color: #ef4444;
}

.nav-item-danger:hover {
  background: #fef2f2;
}

.nav-label {
  white-space: nowrap;
}

/* Bottom */
.sidebar-bottom {
  padding: 0.5rem 0.75rem;
  border-top: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

/* ===== Topbar ===== */
.admin-topbar {
  position: fixed;
  top: 0;
  right: 0;
  height: 4rem;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
  z-index: 30;
  transition: left 0.3s ease;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.topbar-toggle {
  width: 2.25rem;
  height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  border: none;
  background: none;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.15s ease;
}

.topbar-toggle:hover {
  background: #f3f4f6;
  color: #374151;
}

.topbar-title-group {
  display: flex;
  flex-direction: column;
}

.topbar-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.3;
}

.topbar-subtitle {
  font-size: 0.8rem;
  color: #9ca3af;
  line-height: 1.3;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.topbar-notification {
  width: 2.25rem;
  height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  border: none;
  background: none;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.15s ease;
}

.topbar-notification:hover {
  background: #f3f4f6;
  color: #374151;
}

.user-menu-wrapper {
  position: relative;
}

.topbar-user {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border: none;
  background: none;
  cursor: pointer;
  padding: 0.375rem 0.5rem;
  border-radius: 0.5rem;
  transition: background 0.15s ease;
}

.topbar-user:hover {
  background: #f3f4f6;
}

.user-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  min-width: 200px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  padding: 0.375rem;
  z-index: 50;
}

.dropdown-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 0.75rem;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.85rem;
  color: #374151;
  border-radius: 0.375rem;
  transition: background 0.15s ease;
}

.dropdown-item:hover {
  background: #f3f4f6;
}

.dropdown-item-danger {
  color: #ef4444;
}

.dropdown-item-danger:hover {
  background: #fef2f2;
}

.dropdown-divider {
  height: 1px;
  background: #e5e7eb;
  margin: 0.25rem 0;
}

.user-avatar {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: #f0a500;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: 600;
}

.user-info {
  display: flex;
  flex-direction: column;
}

.user-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: #1f2937;
  line-height: 1.3;
}

.user-role {
  font-size: 0.75rem;
  color: #9ca3af;
  line-height: 1.3;
}

/* ===== Main Content ===== */
.admin-main {
  padding-top: 4rem;
  min-height: 100vh;
  transition: margin-left 0.3s ease;
}

.main-content {
  padding: 1.5rem;
}
</style>
