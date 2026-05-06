/**
 * Cache + dedupe cho danh sách phòng ban / công ty dùng lặp ở TopBar, admin, form.
 * Public API: TopBar + AdminDigitization (filter).
 * Admin API: trang CRUD + dropdown nhân sự.
 */
import { ref } from 'vue'
import api, { publicApi } from '../api'

/** Khớp payload GET /admin/departments (danh sách CRUD). */
export interface AdminDepartmentRow {
  id: number
  name: string
  slug: string
  phone: string | null
  sort_order: number
  is_active: boolean
}

/** Khớp payload GET /admin/companies (danh sách CRUD). */
export interface AdminCompanyRow {
  id: number
  name: string
  sort_order: number
  is_active: boolean
}

export interface PublicDepartmentRow {
  id: number
  name: string
  slug: string
}

export interface PublicCompanyRow {
  id: number
  name: string
  slug: string | null
}

export interface SidebarNewsRow {
  id: number
  title: string
  slug: string
  published_at?: string | null
  category?: {
    id: number
    name: string
  } | null
  thumbnail_url?: string | null
  image_urls?: string[] | null
}

// --- Public: /public/departments, /public/companies ---
export const publicDepartments = ref<PublicDepartmentRow[]>([])
export const publicCompanies = ref<PublicCompanyRow[]>([])

let publicOrgLoaded = false
let publicOrgInFlight: Promise<void> | null = null

export function invalidatePublicOrg(): void {
  publicOrgLoaded = false
  publicDepartments.value = []
  publicCompanies.value = []
}

export async function ensurePublicOrgLoaded(): Promise<void> {
  if (publicOrgLoaded) return
  if (publicOrgInFlight) return publicOrgInFlight

  publicOrgInFlight = (async () => {
    const [dr, cr] = await Promise.allSettled([
      publicApi.get('/public/departments'),
      publicApi.get('/public/companies'),
    ])
    if (dr.status === 'fulfilled') {
      const body = dr.value.data as { data?: PublicDepartmentRow[] }
      publicDepartments.value = Array.isArray(body?.data) ? body.data : []
    } else {
      publicDepartments.value = []
    }
    if (cr.status === 'fulfilled') {
      const body = cr.value.data as { data?: PublicCompanyRow[] }
      publicCompanies.value = Array.isArray(body?.data) ? body.data : []
    } else {
      publicCompanies.value = []
    }
    publicOrgLoaded = true
  })().finally(() => {
    publicOrgInFlight = null
  })

  return publicOrgInFlight
}

// --- Admin: /admin/departments, /admin/companies ---
export const adminDepartments = ref<AdminDepartmentRow[]>([])
export const adminCompanies = ref<AdminCompanyRow[]>([])

let adminDeptsLoaded = false
let adminCosLoaded = false
let adminDeptsInFlight: Promise<void> | null = null
let adminCosInFlight: Promise<void> | null = null

export async function ensureAdminDepartments(): Promise<void> {
  if (adminDeptsLoaded) return
  if (adminDeptsInFlight) return adminDeptsInFlight

  adminDeptsInFlight = (async () => {
    try {
      const { data } = await api.get('/admin/departments')
      adminDepartments.value = (data.data || []) as AdminDepartmentRow[]
      adminDeptsLoaded = true
    } catch {
      adminDepartments.value = []
    }
  })().finally(() => {
    adminDeptsInFlight = null
  })
  return adminDeptsInFlight
}

export async function ensureAdminCompanies(): Promise<void> {
  if (adminCosLoaded) return
  if (adminCosInFlight) return adminCosInFlight

  adminCosInFlight = (async () => {
    try {
      const { data } = await api.get('/admin/companies')
      adminCompanies.value = (data.data || []) as AdminCompanyRow[]
      adminCosLoaded = true
    } catch {
      adminCompanies.value = []
    }
  })().finally(() => {
    adminCosInFlight = null
  })
  return adminCosInFlight
}

/** Sau CRUD phòng ban: cập nhật cache admin + làm mới public (menu / filter). */
export async function refreshAdminDepartments(): Promise<void> {
  try {
    const { data } = await api.get('/admin/departments')
    adminDepartments.value = (data.data || []) as AdminDepartmentRow[]
    adminDeptsLoaded = true
  } catch {
    /* giữ dữ liệu cũ */
  }
  invalidatePublicOrg()
  await ensurePublicOrgLoaded()
}

/** Sau CRUD công ty: cập nhật cache admin + làm mới public. */
export async function refreshAdminCompanies(): Promise<void> {
  try {
    const { data } = await api.get('/admin/companies')
    adminCompanies.value = (data.data || []) as AdminCompanyRow[]
    adminCosLoaded = true
  } catch {
    /* giữ dữ liệu cũ */
  }
  invalidatePublicOrg()
  await ensurePublicOrgLoaded()
}

// --- Sidebar tin tức (tránh gọi /public/news/sidebar trùng khi mount lặp) ---
export const sidebarNewsItems = ref<SidebarNewsRow[]>([])
let sidebarNewsLoaded = false
let sidebarNewsInFlight: Promise<void> | null = null

export async function ensureSidebarNews(): Promise<void> {
  if (sidebarNewsLoaded) return
  if (sidebarNewsInFlight) return sidebarNewsInFlight

  sidebarNewsInFlight = (async () => {
    try {
      const { data } = await publicApi.get('/public/news/sidebar')
      sidebarNewsItems.value = data.data || []
      sidebarNewsLoaded = true
    } catch {
      sidebarNewsItems.value = []
    }
  })().finally(() => {
    sidebarNewsInFlight = null
  })
  return sidebarNewsInFlight
}
