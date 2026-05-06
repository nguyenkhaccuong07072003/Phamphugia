<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { publicApi } from '../api'
import { useChatThreads } from '../composables/useChatThreads'

const {
  threads,
  activeThreadId,
  activeThread,
  messages,
  createNewThread,
  selectThread,
  deleteThread,
  maybeSetTitleFromFirstUser,
  touchUpdated,
} = useChatThreads()

const input = ref('')
const sending = ref(false)
const listRef = ref<HTMLElement | null>(null)
const sidebarOpen = ref(false)

const sortedThreads = computed(() =>
  [...threads.value].sort((a, b) => b.createdAt - a.createdAt),
)

watch(
  messages,
  () => {
    nextTick(() => scrollToBottom())
  },
  { deep: true },
)

function scrollToBottom() {
  const el = listRef.value
  if (el) el.scrollTop = el.scrollHeight
}

async function send() {
  const text = input.value.trim()
  if (!text || sending.value) return

  input.value = ''
  messages.value.push({ role: 'user', content: text })
  maybeSetTitleFromFirstUser(text)
  sending.value = true

  try {
    const history = messages.value
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }))

    const { data } = await publicApi.post('/public/chat', { messages: history })
    const reply = data?.data?.message as string | undefined
    if (!reply) {
      throw new Error('Phản hồi không hợp lệ')
    }
    messages.value.push({ role: 'assistant', content: reply })
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
        : null
    messages.value.push({
      role: 'assistant',
      content:
        msg ||
        'Không gửi được tin nhắn. Vui lòng thử lại hoặc liên hệ quản trị nếu lỗi kéo dài.',
    })
  } finally {
    touchUpdated()
    sending.value = false
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}

function onNewChat() {
  createNewThread()
  sidebarOpen.value = false
}

function pickThread(id: string) {
  selectThread(id)
  sidebarOpen.value = false
}

function onDeleteThread(id: string, e: Event) {
  e.stopPropagation()
  deleteThread(id)
}
</script>

<template>
  <div class="chatbot-page w-full max-w-6xl mx-auto px-3 py-5 sm:py-6">
    <div class="flex flex-col gap-3 md:flex-row md:items-stretch md:gap-4">
      <!-- Mobile overlay -->
      <div
        v-if="sidebarOpen"
        class="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px] md:hidden"
        aria-hidden="true"
        @click="sidebarOpen = false"
      />

      <!-- Sidebar: danh sách hội thoại -->
      <aside
        class="sidebar-chat z-50 flex w-full flex-col overflow-hidden rounded-2xl border border-[#d9e5df]/90 bg-linear-to-b from-[#fbfcfb] via-[#f4f8f5] to-[#ecf3ef] shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_4px_24px_-8px_rgba(21,128,61,0.12)] transition-[transform,opacity] md:relative md:z-0 md:max-h-none md:w-[min(100%,19rem)] md:shrink-0 md:translate-x-0 md:opacity-100"
        :class="
          sidebarOpen
            ? 'fixed inset-y-0 left-0 max-h-[min(100dvh,100%)] w-[min(100%,20rem)] max-w-[88vw] translate-x-0 opacity-100 max-md:top-20 max-md:bottom-auto max-md:h-[calc(100dvh-5rem)] max-md:rounded-l-none max-md:rounded-r-2xl max-md:shadow-2xl'
            : 'max-md:pointer-events-none max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:top-20 max-md:h-[calc(100dvh-5rem)] max-md:w-[min(100%,20rem)] max-md:max-w-[88vw] max-md:-translate-x-full max-md:opacity-0'
        "
      >
        <div
          class="flex shrink-0 items-center justify-between gap-3 border-b border-[#dfe9e4]/80 px-4 py-4"
        >
          <div class="flex min-w-0 items-center gap-3">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#15803d]/10 text-[#15803d] ring-1 ring-[#15803d]/15"
            >
              <span class="material-icon text-[22px]">forum</span>
            </div>
            <div class="min-w-0 space-y-1">
              <h2 class="text-[0.9375rem] font-semibold leading-snug tracking-tight text-[#0f172a]">
                Hội thoại
              </h2>
              <p class="text-[0.6875rem] font-medium leading-normal text-[#64748b]">
                Đã lưu trên trình duyệt
              </p>
            </div>
          </div>
          <button
            type="button"
            class="md:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#64748b] transition hover:bg-white/80 hover:text-[#0f172a]"
            aria-label="Đóng danh sách"
            @click="sidebarOpen = false"
          >
            <span class="material-icon text-[22px]">close</span>
          </button>
        </div>

        <div class="shrink-0 px-3 pb-2 pt-1 sm:px-4">
          <button
            type="button"
            class="group/btn flex w-full items-center gap-3 rounded-2xl border border-[#c5d9ce] bg-white/90 px-3.5 py-3 text-left shadow-sm transition hover:border-[#15803d]/45 hover:bg-white hover:shadow-md active:scale-[0.99]"
            @click="onNewChat"
          >
            <span
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-[#15803d] to-[#14532d] text-[#fde68a] shadow-sm ring-1 ring-white/20 transition group-hover/btn:shadow-md"
            >
              <span class="material-icon text-[22px]">add</span>
            </span>
            <span class="min-w-0 flex-1 space-y-1">
              <span class="block text-sm font-semibold leading-snug text-[#0f172a]">Cuộc trò chuyện mới</span>
              <span class="block text-[0.6875rem] leading-relaxed text-[#64748b]">Bắt đầu chủ đề mới</span>
            </span>
          </button>
        </div>

        <div
          class="sidebar-thread-scroll min-h-0 flex-1 overflow-y-auto pb-4 pt-1 pl-4 pr-3 sm:px-5"
        >
          <p
            class="mb-3 pl-1 text-[0.65rem] font-semibold uppercase leading-normal tracking-[0.12em] text-[#94a3af]"
          >
            Gần đây
          </p>
          <ul class="flex flex-col gap-3">
            <li v-for="t in sortedThreads" :key="t.id">
              <div
                class="group/thread relative flex items-stretch gap-2.5 overflow-hidden rounded-2xl pl-4 pr-1 transition-colors"
                :class="
                  t.id === activeThreadId
                    ? 'bg-white shadow-[0_2px_12px_-2px_rgba(21,128,61,0.12)] ring-1 ring-[#15803d]/20 hover:bg-[#f6f8f7]'
                    : 'bg-white/50 ring-1 ring-[#e5ebe8]/80 hover:bg-[#e9efec] hover:ring-[#dce5e0]'
                "
              >
                <!-- Luôn chiếm chỗ 4px: không chọn = trong suốt → chữ thẳng hàng với dòng đang chọn -->
                <div
                  class="w-1 shrink-0 self-stretch rounded-r-sm"
                  :class="
                    t.id === activeThreadId
                      ? 'bg-linear-to-b from-[#4ade80] to-[#15803d]'
                      : 'bg-transparent'
                  "
                  aria-hidden="true"
                />
                <button
                  type="button"
                  class="thread-history-row min-w-0 flex-1 pl-0 pr-12 text-left"
                  @click="pickThread(t.id)"
                >
                  <span
                    class="thread-history-title line-clamp-2 text-[0.8125rem] font-medium leading-[1.45] text-[#1e293b] antialiased"
                    :class="t.id === activeThreadId ? 'text-[#14532d]' : ''"
                  >
                    {{ t.title }}
                  </span>
                </button>
                <button
                  type="button"
                  class="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-[#cbd5e1] transition hover:bg-red-50 hover:text-red-500 max-md:opacity-100 md:opacity-0 md:group-hover/thread:opacity-100"
                  title="Xóa cuộc trò chuyện"
                  aria-label="Xóa cuộc trò chuyện"
                  @click="onDeleteThread(t.id, $event)"
                >
                  <span class="material-icon text-[18px]">delete_outline</span>
                </button>
              </div>
            </li>
          </ul>
        </div>
      </aside>

      <!-- Khung chat -->
      <div
        class="chat-shell flex min-h-[min(72vh,560px)] max-h-[calc(100vh-9rem)] flex-1 flex-col overflow-hidden rounded-2xl border border-[#dfe6e1] bg-white shadow-[0_4px_24px_-4px_rgba(21,128,61,0.12),0_8px_32px_-8px_rgba(0,0,0,0.08)] md:min-h-[min(78vh,620px)]"
      >
        <header
          class="flex shrink-0 items-center justify-between gap-3 border-b border-[#e8ede9] bg-linear-to-r from-[#15803d] to-[#166534] px-4 py-3.5 text-white sm:px-5"
        >
          <div class="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <button
              type="button"
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/95 transition hover:bg-white/15 md:hidden"
              aria-label="Mở danh sách hội thoại"
              @click="sidebarOpen = true"
            >
              <span class="material-icon text-[24px]">menu</span>
            </button>
            <div
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20"
            >
              <span class="material-icon text-[#f0a500] text-[26px]">smart_toy</span>
            </div>
            <div class="min-w-0">
              <h1 class="truncate text-[1.05rem] font-semibold tracking-tight text-white">Trợ lý AI</h1>
              <p class="truncate text-xs font-normal text-white/80">
                {{ activeThread?.title ?? '—' }}
              </p>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <button
              type="button"
              class="hidden h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-white/95 transition hover:bg-white/15 sm:flex"
              title="Cuộc trò chuyện mới"
              @click="onNewChat"
            >
              <span class="material-icon text-[20px] text-[#f0a500]">add</span>
              <span class="hidden lg:inline">Cuộc trò chuyện mới</span>
            </button>
          </div>
        </header>

        <div
          ref="listRef"
          class="chat-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[linear-gradient(180deg,#f0f4f1_0%,#f6f8f6_50%,#f3f5f4_100%)] py-4"
          style="padding-left: 10px; padding-right: 10px"
        >
          <div class="mx-auto flex max-w-full flex-col gap-4">
            <div
              v-for="(m, i) in messages"
              :key="`${activeThreadId}-${i}`"
              class="msg-row flex w-full"
              :class="m.role === 'user' ? 'justify-end' : 'justify-start'"
            >
              <div
                class="flex max-w-[min(100%,28rem)] items-end gap-2.5"
                :class="m.role === 'user' ? 'flex-row-reverse' : 'flex-row'"
              >
                <div
                  class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px] shadow-sm"
                  :class="
                    m.role === 'user'
                      ? 'bg-[#15803d] text-[#f0a500] ring-2 ring-white'
                      : 'bg-white text-[#15803d] ring-1 ring-[#dfe6e1]'
                  "
                >
                  <span class="material-icon text-[18px]">{{ m.role === 'user' ? 'person' : 'smart_toy' }}</span>
                </div>
                <div
                  class="min-w-0 max-w-[min(100%,calc(100%-2.5rem))] sm:max-w-[min(100%,26rem)]"
                  :class="m.role === 'user' ? 'text-right' : 'text-left'"
                >
                  <span
                    class="mb-1 block text-[0.6875rem] font-medium uppercase tracking-wide text-[#6b7c72]"
                    :class="m.role === 'user' ? 'pr-0.5' : 'pl-0.5'"
                  >
                    {{ m.role === 'user' ? 'Bạn' : 'Trợ lý' }}
                  </span>
                  <div
                    class="bubble inline-block rounded-2xl px-4 py-2.5 text-[0.9375rem] leading-[1.55] shadow-sm"
                    :class="
                      m.role === 'user'
                        ? 'bg-[#15803d] text-white rounded-br-md text-left shadow-[0_2px_12px_-2px_rgba(21,128,61,0.35)]'
                        : 'rounded-bl-md border border-[#e3e9e5] bg-white text-[#1a2024] text-left shadow-[0_1px_3px_rgba(0,0,0,0.06)]'
                    "
                  >
                    <p class="whitespace-pre-wrap wrap-break-word">{{ m.content }}</p>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="sending" class="msg-row flex w-full justify-start">
              <div class="flex max-w-[min(100%,28rem)] items-end gap-2.5">
                <div
                  class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#15803d] ring-1 ring-[#dfe6e1] shadow-sm"
                >
                  <span class="material-icon text-[18px]">smart_toy</span>
                </div>
                <div class="flex min-w-0 flex-col pt-1">
                  <span class="mb-1 block pl-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-[#6b7c72]">
                    Trợ lý
                  </span>
                  <div
                    class="inline-flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-[#e3e9e5] bg-white px-4 py-3 text-sm text-[#6b7280] shadow-sm"
                  >
                    <span class="typing-dot" />
                    <span class="typing-dot" />
                    <span class="typing-dot" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer
          class="shrink-0 border-t border-[#e8ede9] bg-white px-3 py-3.5 sm:px-4"
          style="padding-left: 10px; padding-right: 10px"
        >
          <div class="flex items-end gap-2.5">
            <label class="sr-only" for="chat-input">Nội dung tin nhắn</label>
            <div class="min-h-12 flex-1 flex items-stretch">
              <textarea
                id="chat-input"
                v-model="input"
                rows="1"
                class="chat-input w-full resize-none rounded-xl border border-[#cfd8d3] bg-[#fafcfb] text-[0.9375rem] text-[#111827] shadow-inner placeholder:text-[#8a9a91] focus:border-[#15803d] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803d]/25"
                placeholder="Nhập câu hỏi..."
                :disabled="sending"
                @keydown="onKeydown"
              />
            </div>
            <button
              type="button"
              class="group flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#15803d] text-[#f0a500] shadow-md transition hover:bg-[#14532d] hover:shadow-lg disabled:pointer-events-none disabled:opacity-45"
              title="Gửi"
              aria-label="Gửi tin nhắn"
              :disabled="sending || !input.trim()"
              @click="send"
            >
              <span class="material-icon text-[22px] transition group-hover:translate-x-0.5">send</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sidebar-thread-scroll {
  scrollbar-width: thin;
  scrollbar-color: #a8c9b8 transparent;
}

.sidebar-thread-scroll::-webkit-scrollbar {
  width: 6px;
}

.sidebar-thread-scroll::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #94cba5, #15803d);
  border-radius: 9999px;
}

.sidebar-thread-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.thread-history-title {
  word-break: break-word;
  overflow-wrap: anywhere;
}

/* Padding ô lịch sử — scoped để luôn áp dụng ổn định */
.thread-history-row {
  box-sizing: border-box;
  padding-top: 0.625rem;
  padding-bottom: 0.625rem;
}

.material-icon {
  font-family: 'Material Icons';
  font-size: 20px;
  vertical-align: middle;
  line-height: 1;
}

.chat-input {
  box-sizing: border-box;
  min-height: 48px;
  max-height: 160px;
  padding: 11px 14px;
  line-height: 24px;
  field-sizing: content;
}

.chat-input::placeholder {
  line-height: 24px;
}

@supports not (field-sizing: content) {
  .chat-input {
    min-height: 48px;
  }
}

.typing-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: #15803d;
  opacity: 0.35;
  animation: typing-bounce 1.2s ease-in-out infinite;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.15s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes typing-bounce {
  0%,
  80%,
  100% {
    opacity: 0.3;
    transform: translateY(0);
  }
  40% {
    opacity: 1;
    transform: translateY(-3px);
  }
}
</style>
