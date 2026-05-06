import { ref, computed, watch } from 'vue'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatThread {
  id: string
  title: string
  /** Thời điểm tạo cuộc — dùng để sắp xếp danh sách */
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
}

/** Tăng phiên bản khi cần bỏ qua dữ liệu localStorage cũ (ví dụ tin lỗi API đã lưu sẵn). */
const STORAGE_KEY = 'phamphugia_chat_threads_v3'
const ACTIVE_ID_KEY = 'phamphugia_chat_active_id_v3'
const MAX_THREADS = 60
const TITLE_MAX = 52

function welcomeMessages(): ChatMessage[] {
  return [
    {
      role: 'assistant',
      content: 'Xin chào! Tôi là trợ lý AI. Tôi có thể giúp gì cho bạn?',
    },
  ]
}

function defaultTitle() {
  return 'Cuộc trò chuyện mới'
}

/** Tin assistant là lỗi cấu hình đã lưu cục bộ (kể cả bản cũ nhắc OPENAI) — không hiển thị lại. */
function filterStaleConfigErrorMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter((m) => {
    if (m.role !== 'assistant') return true
    const c = m.content
    if (/OPENAI_API_KEY/i.test(c)) return false
    if (/Chatbot chưa được cấu hình/i.test(c) && /thiếu|API_KEY|trên server/i.test(c)) return false
    return true
  })
}

function loadState(): { threads: ChatThread[]; activeId: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const active = localStorage.getItem(ACTIVE_ID_KEY)
    if (!raw) {
      return { threads: [], activeId: active }
    }
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return { threads: [], activeId: active }
    const threads: ChatThread[] = []
    for (const item of parsed) {
      if (
        item &&
        typeof item === 'object' &&
        'id' in item &&
        'messages' in item &&
        Array.isArray((item as ChatThread).messages)
      ) {
        const t = item as ChatThread
        const updatedAt = typeof t.updatedAt === 'number' ? t.updatedAt : Date.now()
        const createdAtRaw = (t as { createdAt?: number }).createdAt
        const createdAt =
          typeof createdAtRaw === 'number' ? createdAtRaw : updatedAt
        const cleaned = filterStaleConfigErrorMessages(
          t.messages.filter(
            (m): m is ChatMessage =>
              m &&
              typeof m === 'object' &&
              (m.role === 'user' || m.role === 'assistant') &&
              typeof m.content === 'string',
          ),
        )
        threads.push({
          id: String(t.id),
          title: typeof t.title === 'string' ? t.title : defaultTitle(),
          createdAt,
          updatedAt,
          messages: cleaned,
        })
      }
    }
    return { threads, activeId: active }
  } catch {
    return { threads: [], activeId: null }
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave(threads: ChatThread[], activeId: string | null) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(threads))
      if (activeId) localStorage.setItem(ACTIVE_ID_KEY, activeId)
      else localStorage.removeItem(ACTIVE_ID_KEY)
    } catch {
      // quota / private mode
    }
  }, 120)
}

const threads = ref<ChatThread[]>([])
const activeThreadId = ref<string | null>(null)
let bootstrapped = false

function bootstrap() {
  if (bootstrapped) return
  bootstrapped = true
  const { threads: t, activeId } = loadState()
  threads.value = t
  if (t.length === 0) {
    const id = crypto.randomUUID()
    const now = Date.now()
    threads.value = [
      {
        id,
        title: defaultTitle(),
        createdAt: now,
        updatedAt: now,
        messages: welcomeMessages(),
      },
    ]
    activeThreadId.value = id
  } else {
    const found = activeId && t.some((x) => x.id === activeId)
    if (found) activeThreadId.value = activeId
    else {
      const newest = [...t].sort((a, b) => b.createdAt - a.createdAt)[0]
      activeThreadId.value = newest?.id ?? null
    }
  }
}

export function useChatThreads() {
  bootstrap()

  const activeThread = computed(() =>
    threads.value.find((x) => x.id === activeThreadId.value) ?? null,
  )

  const messages = computed({
    get: () => activeThread.value?.messages ?? welcomeMessages(),
    set: (next: ChatMessage[]) => {
      const tr = activeThread.value
      if (!tr) return
      tr.messages = next
      tr.updatedAt = Date.now()
    },
  })

  watch(
    [threads, activeThreadId],
    () => {
      scheduleSave(threads.value, activeThreadId.value)
    },
    { deep: true },
  )

  function createNewThread() {
    const id = crypto.randomUUID()
    const now = Date.now()
    const thread: ChatThread = {
      id,
      title: defaultTitle(),
      createdAt: now,
      updatedAt: now,
      messages: welcomeMessages(),
    }
    threads.value = [thread, ...threads.value].slice(0, MAX_THREADS)
    activeThreadId.value = id
  }

  function selectThread(id: string) {
    if (threads.value.some((x) => x.id === id)) activeThreadId.value = id
  }

  function deleteThread(id: string) {
    if (threads.value.length <= 1) {
      const only = threads.value[0]
      if (only) {
        const now = Date.now()
        only.messages = welcomeMessages()
        only.title = defaultTitle()
        only.createdAt = now
        only.updatedAt = now
      }
      return
    }
    threads.value = threads.value.filter((x) => x.id !== id)
    if (activeThreadId.value === id) {
      activeThreadId.value = threads.value[0]?.id ?? null
    }
  }

  function maybeSetTitleFromFirstUser(text: string) {
    const tr = activeThread.value
    if (!tr) return
    const isDefault = tr.title === defaultTitle() || tr.title.startsWith('Cuộc trò chuyện')
    const userCount = tr.messages.filter((m) => m.role === 'user').length
    if (isDefault && userCount === 1) {
      const line = text.trim().replace(/\s+/g, ' ')
      tr.title =
        line.length > TITLE_MAX ? `${line.slice(0, TITLE_MAX - 1)}…` : line || defaultTitle()
      tr.updatedAt = Date.now()
    }
  }

  function touchUpdated() {
    const tr = activeThread.value
    if (tr) tr.updatedAt = Date.now()
  }

  return {
    threads,
    activeThreadId,
    activeThread,
    messages,
    createNewThread,
    selectThread,
    deleteThread,
    maybeSetTitleFromFirstUser,
    touchUpdated,
  }
}
