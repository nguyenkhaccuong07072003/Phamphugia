import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '../views/HomePage.vue'
import AdminLogin from '../views/admin/AdminLogin.vue'
import AllNews from '../views/AllNews.vue'
import NewsDetail from '../views/NewsDetail.vue'
import DepartmentDetail from '../views/DepartmentDetail.vue'
import SubMenuPage from '../views/SubMenuPage.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage
    },
    {
      path: '/news',
      name: 'all-news',
      component: AllNews
    },
    {
      path: '/chat',
      name: 'chatbot',
      component: () => import('../views/ChatbotPage.vue')
    },
    {
      path: '/news/:slug',
      name: 'news-detail',
      component: NewsDetail
    },
    {
      path: '/products/:slug',
      name: 'product-detail',
      component: NewsDetail
    },
    {
      path: '/department/:slug',
      name: 'department-detail',
      component: DepartmentDetail
    },
    {
      path: '/page/:slug',
      name: 'sub-menu-page',
      component: SubMenuPage
    },
    {
      path: '/page/:deptSlug/:slug',
      name: 'sub-menu-page-nested',
      component: SubMenuPage
    },
    {
      path: '/page/:deptSlug/:parentSlug/:slug',
      name: 'sub-menu-page-level3',
      component: SubMenuPage
    },
    {
      path: '/digitization/history',
      name: 'digitization-history',
      component: () => import('../views/DigitizationHistory.vue')
    },
    {
      path: '/digitization/result/:submissionId',
      name: 'digitization-result',
      component: () => import('../views/DigitizationResult.vue')
    },
    {
      path: '/digitization/:slug',
      name: 'digitization-form',
      component: () => import('../views/DigitizationForm.vue')
    },
    {
      path: '/admin/login',
      name: 'admin-login',
      component: AdminLogin
    },
    {
      path: '/admin',
      component: () => import('../layouts/AdminLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'admin-dashboard',
          component: () => import('../views/admin/AdminDashboard.vue')
        },
        {
          path: 'news-categories',
          name: 'admin-news-categories',
          component: () => import('../views/admin/AdminNewsCategories.vue')
        },
        {
          path: 'news',
          name: 'admin-news',
          component: () => import('../views/admin/AdminNews.vue')
        },
        {
          path: 'sliders',
          name: 'admin-sliders',
          component: () => import('../views/admin/AdminSliders.vue')
        },
        {
          path: 'departments',
          name: 'admin-departments',
          component: () => import('../views/admin/AdminDepartments.vue')
        },
        {
          path: 'companies',
          name: 'admin-companies',
          component: () => import('../views/admin/AdminCompanies.vue')
        },
        {
          path: 'employees',
          name: 'admin-employees',
          component: () => import('../views/admin/AdminEmployees.vue')
        },
        {
          path: 'attendance',
          name: 'admin-attendance',
          component: () => import('../views/admin/AdminAttendance.vue')
        },
        {
          path: 'leave-requests',
          name: 'admin-leave-requests',
          component: () => import('../views/admin/AdminLeaveRequests.vue')
        },
        {
          path: 'digitization',
          name: 'admin-digitization',
          component: () => import('../views/admin/AdminDigitization.vue')
        }
      ]
    }
  ]
})

router.beforeEach((to, _from, next) => {
  if (to.matched.some(record => record.meta.requiresAuth)) {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      next({ name: 'admin-login' })
    } else {
      next()
    }
  } else {
    next()
  }
})

export default router
