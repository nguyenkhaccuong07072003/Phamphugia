<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue'
import { publicApi } from '../api'
import { useChatThreads } from '../composables/useChatThreads'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()

const {
  threads,
  activeThreadId,
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
const threadPickerOpen = ref(false)

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

function closePanel() {
  emit('update:open', false)
}

function onDocumentKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !props.open) return
  if (threadPickerOpen.value) {
    threadPickerOpen.value = false
    return
  }
  closePanel()
}

let pickerOutsideCleanup: (() => void) | null = null

watch(threadPickerOpen, (open) => {
  pickerOutsideCleanup?.()
  pickerOutsideCleanup = null
  if (!open) return
  const handler = (e: MouseEvent) => {
    const el = e.target as HTMLElement
    if (el.closest('[data-thread-picker-root]')) return
    threadPickerOpen.value = false
  }
  const tid = window.setTimeout(() => {
    document.addEventListener('click', handler, true)
  }, 0)
  pickerOutsideCleanup = () => {
    clearTimeout(tid)
    document.removeEventListener('click', handler, true)
  }
})

onMounted(() => document.addEventListener('keydown', onDocumentKeydown))
onUnmounted(() => {
  document.removeEventListener('keydown', onDocumentKeydown)
  pickerOutsideCleanup?.()
})

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
  threadPickerOpen.value = false
}

function onDeleteThread(id: string) {
  deleteThread(id)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-60 flex items-stretch justify-end bg-black/40 backdrop-blur-[2px]"
      role="presentation"
      @click.self="closePanel"
    >
      <div
        class="flex h-full w-full max-w-[420px] flex-col border-l border-[#dfe6e1] bg-[#f0f2f5] shadow-2xl"
        @click.stop
      >
        <div
          class="chat-shell flex min-h-0 flex-1 flex-col overflow-hidden border-[#dfe6e1] bg-white shadow-[0_4px_24px_-4px_rgba(21,128,61,0.12),0_8px_32px_-8px_rgba(0,0,0,0.08)]"
        >
          <header
            class="flex shrink-0 items-center justify-between gap-3 border-b border-[#e8ede9] bg-linear-to-r from-[#15803d] to-[#166534] px-4 py-3.5 text-white sm:px-5"
          >
            <div class="flex min-w-0 items-center gap-3">
              <div
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20"
              >
                <span class="material-icon text-[26px] text-[#f0a500]">smart_toy</span>
              </div>
              <div class="min-w-0">
                <h2 class="text-[1.05rem] font-semibold tracking-tight text-white">Trợ lý AI</h2>
              </div>
            </div>
            <div class="relative flex shrink-0 items-center gap-1" data-thread-picker-root>
              <button
                type="button"
                class="flex h-10 w-10 items-center justify-center rounded-xl text-white/95 transition hover:bg-white/15"
                title="Chọn hội thoại"
                aria-label="Chọn hội thoại"
                :aria-expanded="threadPickerOpen"
                @click.stop="threadPickerOpen = !threadPickerOpen"
              >
                <span class="material-icon text-[22px]">history</span>
              </button>
              <button
                type="button"
                class="flex h-10 w-10 items-center justify-center rounded-xl text-white/95 transition hover:bg-white/15"
                title="Cuộc trò chuyện mới"
                @click="onNewChat"
              >
                <span class="material-icon text-[22px]">add</span>
              </button>
              <button
                type="button"
                class="flex h-10 w-10 items-center justify-center rounded-xl text-white/95 transition hover:bg-white/15"
                title="Đóng"
                aria-label="Đóng trò chuyện"
                @click="closePanel"
              >
                <span class="material-icon text-[22px]">close</span>
              </button>
              <div
                v-if="threadPickerOpen"
                class="thread-picker-dropdown absolute right-12 top-full z-10 mt-2 max-h-72 w-[min(100vw-2rem,19rem)] overflow-hidden rounded-2xl border border-[#d9e5df]/90 bg-linear-to-b from-[#fbfcfb] to-[#eef5f1] py-2 text-[#1a2024] shadow-[0_12px_40px_-12px_rgba(21,128,61,0.25)] ring-1 ring-black/[0.04]"
                role="listbox"
              >
                <p
                  class="px-4 pb-3 pt-1 text-[0.65rem] font-semibold uppercase leading-normal tracking-[0.12em] text-[#94a3af]"
                >
                  Hội thoại đã lưu
                </p>
                <div class="thread-picker-scroll max-h-56 overflow-y-auto px-2 pb-2">
                  <div
                    v-for="t in sortedThreads"
                    :key="t.id"
                    class="group/pick mb-2 flex items-stretch gap-2.5 overflow-hidden rounded-xl pl-3.5 pr-0.5 transition-colors last:mb-0"
                    :class="
                      t.id === activeThreadId
                        ? 'bg-white shadow-sm ring-1 ring-[#15803d]/25 hover:bg-[#f6f8f7]'
                        : 'bg-white/60 ring-1 ring-[#e8eeeb]/90 hover:bg-[#e9efec]'
                    "
                    role="option"
                  >
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
                      class="min-w-0 flex-1 py-[1.625rem] pl-0 pr-2 text-left"
                      :class="t.id === activeThreadId ? 'text-[#14532d]' : 'text-[#1e293b]'"
                      @click="selectThread(t.id); threadPickerOpen = false"
                    >
                      <span class="thread-picker-title line-clamp-2 text-[0.8125rem] font-medium leading-[1.45] antialiased">{{
                        t.title
                      }}</span>
                    </button>
                    <button
                      type="button"
                      class="flex w-9 shrink-0 items-center justify-center rounded-lg text-[#cbd5e1] transition hover:bg-red-50 hover:text-red-500 max-md:opacity-100 md:opacity-0 md:group-hover/pick:opacity-100"
                      title="Xóa cuộc trò chuyện"
                      aria-label="Xóa cuộc trò chuyện"
                      @click.stop="onDeleteThread(t.id)"
                    >
                      <span class="material-icon text-[18px]">delete_outline</span>
                    </button>
                  </div>
                </div>
              </div>
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
                          ? 'rounded-br-md bg-[#15803d] text-left text-white shadow-[0_2px_12px_-2px_rgba(21,128,61,0.35)]'
                          : 'rounded-bl-md border border-[#e3e9e5] bg-white text-left text-[#1a2024] shadow-[0_1px_3px_rgba(0,0,0,0.06)]'
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
                    <span
                      class="mb-1 block pl-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-[#6b7c72]"
                    >
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
              <label class="sr-only" for="chat-input-panel">Nội dung tin nhắn</label>
              <div class="flex min-h-12 flex-1 items-stretch">
                <textarea
                  id="chat-input-panel"
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
  </Teleport>
</template>

<style scoped>
.thread-picker-title {
  word-break: break-word;
  overflow-wrap: anywhere;
}

.thread-picker-row {
  box-sizing: border-box;
  padding-top: 0.625rem;
  padding-bottom: 0.625rem;
}

.thread-picker-scroll {
  scrollbar-width: thin;
  scrollbar-color: #a8c9b8 transparent;
}

.thread-picker-scroll::-webkit-scrollbar {
  width: 5px;
}

.thread-picker-scroll::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #94cba5, #15803d);
  border-radius: 9999px;
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
