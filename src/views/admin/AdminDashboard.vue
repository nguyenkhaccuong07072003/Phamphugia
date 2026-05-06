<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '../../api'

const stats = ref([
  { label: 'Tin tức', count: 0, icon: 'newspaper', color: 'indigo' },
  { label: 'Slider / Banner', count: 0, icon: 'image', color: 'green' },
  { label: 'Nhân sự', count: 0, icon: 'people', color: 'purple' },
  { label: 'Văn bản', count: 0, icon: 'description', color: 'orange' },
])

const colorClasses: Record<string, { bg: string; icon: string }> = {
  indigo: { bg: 'bg-indigo-100', icon: 'text-indigo-600' },
  green: { bg: 'bg-green-100', icon: 'text-green-600' },
  purple: { bg: 'bg-purple-100', icon: 'text-purple-600' },
  orange: { bg: 'bg-orange-100', icon: 'text-orange-600' },
}

const recentNews = ref<{ id: number; title: string; date: string; status: string }[]>([])

onMounted(async () => {
  try {
    const { data } = await api.get('/admin/news', { params: { limit: 5 } })
    const rows = data.data?.rows || data.data || []
    recentNews.value = rows.map((item: any) => ({
      id: item.id,
      title: item.title,
      date: item.published_at || item.created_at?.split('T')[0] || '',
      status: item.is_published ? 'published' : 'draft',
    }))
    // Update news count from pagination total
    const totalNews = data.data?.count ?? rows.length
    const newsStat = stats.value[0]
    if (newsStat) newsStat.count = totalNews
  } catch {
    // keep defaults
  }
})

function statusClass(status: string) {
  return status === 'published'
    ? 'bg-green-100 text-green-700'
    : 'bg-yellow-100 text-yellow-700'
}

function statusLabel(status: string) {
  return status === 'published' ? 'Đã đăng' : 'Bản nháp'
}
</script>

<template>
  <div class="space-y-6">
    <!-- Page header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-800">Dashboard</h1>
      <p class="text-gray-500 text-sm">Tổng quan hệ thống quản trị nội dung</p>
    </div>

    <!-- Stats cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="stats-card"
      >
        <div class="stats-card-content">
          <div>
            <p class="stats-label">{{ stat.label }}</p>
            <p class="stats-value">{{ stat.count }}</p>
          </div>
          <div class="stats-icon" :class="colorClasses[stat.color]!.bg">
            <span class="material-icon text-2xl" :class="colorClasses[stat.color]!.icon">{{ stat.icon }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent news -->
    <div class="content-card">
      <div class="card-header">
        <h2 class="card-title">Tin tức gần đây</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th class="table-th">ID</th>
              <th class="table-th">Tiêu đề</th>
              <th class="table-th">Ngày đăng</th>
              <th class="table-th">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="news in recentNews"
              :key="news.id"
              class="table-row"
            >
              <td class="table-td text-gray-400">#{{ news.id }}</td>
              <td class="table-td font-medium text-gray-800">{{ news.title }}</td>
              <td class="table-td text-gray-500">{{ news.date }}</td>
              <td class="table-td">
                <span
                  class="status-badge"
                  :class="statusClass(news.status)"
                >
                  {{ statusLabel(news.status) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.material-icon {
  font-family: 'Material Icons';
  font-weight: normal;
  font-style: normal;
  font-size: 24px;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  display: inline-block;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  -webkit-font-smoothing: antialiased;
}

/* Stats Card */
.stats-card {
  background: #fff;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.stats-card-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stats-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #6b7280;
}

.stats-value {
  font-size: 1.875rem;
  font-weight: 700;
  color: #1f2937;
  margin-top: 0.25rem;
}

.stats-icon {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Content Card */
.content-card {
  background: #fff;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.card-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #f3f4f6;
}

.card-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
}

/* Table */
.data-table {
  width: 100%;
  font-size: 0.875rem;
}

.table-th {
  padding: 0.75rem 1.5rem;
  text-align: left;
  font-weight: 500;
  color: #6b7280;
  border-bottom: 1px solid #f3f4f6;
}

.table-row {
  border-bottom: 1px solid #f9fafb;
  transition: background 0.15s ease;
}

.table-row:hover {
  background: #f9fafb;
}

.table-td {
  padding: 0.75rem 1.5rem;
}

.status-badge {
  display: inline-block;
  padding: 0.125rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}
</style>
