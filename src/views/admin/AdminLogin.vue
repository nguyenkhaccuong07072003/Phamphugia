<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { publicApi } from '../../api'

const router = useRouter()
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const showPassword = ref(false)

function messageFromLoginError(err: unknown): string {
  const res = (err as { response?: { data?: { message?: string; errors?: Array<{ message?: string }> } } })?.response?.data
  if (!res) {
    return 'Không kết nối được máy chủ.'
  }
  if (Array.isArray(res.errors) && res.errors.length > 0) {
    const parts = res.errors.map((e) => e.message).filter(Boolean)
    if (parts.length) return parts.join(' ')
  }
  if (typeof res.message === 'string' && res.message) return res.message
  return 'Đăng nhập thất bại'
}

async function handleLogin() {
  error.value = ''

  if (!email.value?.trim() || !password.value) {
    error.value = 'Vui lòng nhập đầy đủ thông tin'
    return
  }

  loading.value = true
  try {
    const { data } = await publicApi.post('/auth/login', {
      email: email.value.trim().toLowerCase(),
      password: password.value,
    })
    localStorage.setItem('admin_token', data.data.token)
    if (data.data.refreshToken) {
      localStorage.setItem('admin_refresh_token', data.data.refreshToken)
    }
    router.push('/admin')
  } catch (err: unknown) {
    error.value = messageFromLoginError(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-200">
    <div class="login-container">
      <!-- Logo -->
      <div class="login-logo">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-[#f0a500] rounded-xl">
          <span class="text-white font-bold text-3xl">M</span>
        </div>
      </div>

      <!-- Form -->
      <div class="login-form">
        <div class="login-head">
          <h3 class="login-title">Đăng nhập</h3>
        </div>

        <!-- Error message -->
        <div v-if="error" class="login-error">
          <span class="material-icon">error</span>
          {{ error }}
        </div>

        <form @submit.prevent="handleLogin">
          <div class="form-group">
            <input v-model="email" type="email" placeholder="Email" class="login-input" autocomplete="email" />
          </div>

          <div class="form-group">
            <div class="password-wrapper">
              <input v-model="password" :type="showPassword ? 'text' : 'password'" placeholder="Mật khẩu"
                class="login-input" autocomplete="current-password" />
              <button type="button" class="password-toggle" @click="showPassword = !showPassword">
                <span class="material-icon">{{ showPassword ? 'visibility_off' : 'visibility' }}</span>
              </button>
            </div>
          </div>

          <div class="login-actions">
            <button type="submit" class="login-btn" :disabled="loading">
              <svg v-if="loading" class="animate-spin" width="18" height="18" xmlns="http://www.w3.org/2000/svg"
                fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
                </path>
              </svg>
              {{ loading ? 'Đang đăng nhập...' : 'Đăng nhập' }}
            </button>
          </div>
        </form>
      </div>
    </div>
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

.login-container {
  width: 100%;
  max-width: 420px;
  background: #fff;
  border-radius: 12px;
  padding: 40px 50px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
}

.login-logo {
  text-align: center;
  margin-bottom: 30px;
}

.login-form {
  width: 100%;
}

.login-head {
  margin-bottom: 24px;
}

.login-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #333;
  text-align: center;
}

.login-error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding: 10px 14px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  border-radius: 8px;
  font-size: 0.875rem;
}

.login-error .material-icon {
  font-size: 18px;
}

.form-group {
  margin-bottom: 16px;
}

.login-input {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 0.9rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  background: #fff;
  color: #333;
  box-sizing: border-box;
}

.login-input:focus {
  border-color: #f0a500;
  box-shadow: 0 0 0 3px rgba(240, 165, 0, 0.15);
}

.login-input::placeholder {
  color: #9ca3af;
}

.password-wrapper {
  position: relative;
}

.password-wrapper .login-input {
  padding-right: 2.75rem;
}

.password-toggle {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: #9ca3af;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
}

.password-toggle:hover {
  color: #6b7280;
}

.login-actions {
  margin-top: 24px;
}

.login-btn {
  width: 100%;
  padding: 0.75rem 1.5rem;
  font-size: 0.95rem;
  font-weight: 600;
  border: none;
  border-radius: 50px;
  background: #1a1a1a;
  color: #fff;
  cursor: pointer;
  transition: background 0.2s, opacity 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.login-btn:hover {
  background: #333;
}

.login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.login-demo {
  margin-top: 24px;
  padding: 10px;
  background: #f0f4ff;
  border-radius: 8px;
  text-align: center;
}

.login-demo p {
  font-size: 0.75rem;
  color: #4f6dca;
}
</style>
