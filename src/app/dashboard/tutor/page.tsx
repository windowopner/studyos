'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { requestJSON } from '@/lib/http'
import { toast } from '@/components/toaster'
import { ArrowUp, ChatCircleText, Plus, WarningCircle, X } from '@phosphor-icons/react'

type Message = { role: 'user' | 'assistant'; content: string }
type Assignment = { id: string; title: string; description: string | null }
type Note = { id: string; title: string; content: string | null }
type Chat = { id: string; title: string | null; messages: Message[] }

function TutorContent() {
  const searchParams = useSearchParams()
  const assignmentId = searchParams.get('assignment')
  const noteId = searchParams.get('note')

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedAssignment, setSelectedAssignment] = useState(assignmentId || '')
  const [selectedNote, setSelectedNote] = useState(noteId || '')
  const [chats, setChats] = useState<Chat[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const assignment = useMemo(
    () => selectedAssignment ? assignments.find((item) => item.id === selectedAssignment) || null : null,
    [selectedAssignment, assignments]
  )
  const note = useMemo(
    () => selectedNote ? notes.find((item) => item.id === selectedNote) || null : null,
    [selectedNote, notes]
  )

  async function loadChats() {
    const { data } = await supabase
      .from('ai_chats')
      .select('id, title, messages')
      .order('created_at', { ascending: false })
      .limit(20)

    setChats(data || [])
  }

  useEffect(() => {
    supabase.from('assignments').select('id, title, description').then(({ data }) => setAssignments(data || []))
    supabase.from('notes').select('id, title, content').then(({ data }) => setNotes(data || []))

    supabase
      .from('ai_chats')
      .select('id, title, messages')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setChats(data || []))

    requestJSON<{ configured: boolean }>('/api/ai-status').then((result) => { if (result.ok) setAiConfigured(!!result.data.configured) })
  }, [])

  const loadChat = (chat: Chat) => {
    if (loading) return
    setCurrentChatId(chat.id)
    setMessages((Array.isArray(chat.messages) ? chat.messages : []).filter((message) => typeof message?.content === 'string'))
    setError('')
  }

  const newChat = () => {
    if (loading) return
    setCurrentChatId(null)
    setMessages([])
    setError('')
    setSelectedAssignment('')
    setSelectedNote('')
  }

  const deleteChat = async (chatId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    if (!confirm('Delete this chat?')) return
    const { error } = await supabase.from('ai_chats').delete().eq('id', chatId)
    if (error) { toast(error.message, 'error'); return }
    if (currentChatId === chatId) newChat()
    loadChats()
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMessage: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMessage]

    setMessages(newMessages)
    setInput('')
    setError('')
    setLoading(true)

    const result = await requestJSON<{ reply: string }>('/api/tutor', { body: { messages: newMessages, assignment, note } })
    setLoading(false)

    // On failure the question goes back into the box so it isn't lost, and nothing is saved.
    if (!result.ok || !result.data.reply) {
      setError(result.ok ? 'The tutor could not answer. Try again.' : result.error)
      setMessages(messages)
      setInput(text)
      return
    }

    const updatedMessages = [...newMessages, { role: 'assistant' as const, content: result.data.reply }]
    setMessages(updatedMessages)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (currentChatId) {
      const { error: saveError } = await supabase.from('ai_chats').update({ messages: updatedMessages }).eq('id', currentChatId)
      if (saveError) toast('The answer is shown but could not be saved to your history.', 'error')
    } else {
      const { data: chat, error: saveError } = await supabase
        .from('ai_chats')
        .insert({
          profile_id: user.id,
          title: userMessage.content.slice(0, 50),
          messages: updatedMessages,
          assignment_id: selectedAssignment || null,
          note_id: selectedNote || null,
        })
        .select()
        .single()

      if (chat) setCurrentChatId(chat.id)
      if (saveError) toast('The answer is shown but could not be saved to your history.', 'error')
    }

    loadChats()
  }

  return (
    <div className="grid gap-4 lg:h-[calc(100dvh-6.5rem)] lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col">
        <button onClick={newChat} className="secondary-button w-full rounded-xl px-4 py-2 text-sm font-medium">
          <Plus size={16} />
          New chat
        </button>
        <p className="mb-2 mt-5 px-1 text-xs font-medium text-[var(--text-muted)]">Recent</p>
        <ul className="-mx-1 flex-1 space-y-0.5 overflow-y-auto">
          {chats.length === 0 && <li className="px-2 py-2 text-xs text-[var(--text-muted)]">Your chats will be listed here.</li>}
          {chats.map((chat) => {
            const active = currentChatId === chat.id
            return (
              <li key={chat.id} className="group relative">
                <button
                  onClick={() => loadChat(chat)}
                  className={`w-full truncate rounded-lg py-2 pl-3 pr-8 text-left text-sm ${
                    active ? 'bg-[var(--surface-soft)] font-medium text-[var(--text)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'
                  }`}
                >
                  {chat.title || 'Untitled'}
                </button>
                <button
                  onClick={(event) => deleteChat(chat.id, event)}
                  aria-label="Delete chat"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-[var(--text-muted)] opacity-0 hover:text-[var(--danger)] focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <X size={12} />
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      <section className="glass-panel flex min-h-[70dvh] min-w-0 flex-col rounded-2xl lg:min-h-0">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 sm:px-5">
          <h1 className="mr-auto text-base font-semibold text-[var(--text)]">AI Tutor</h1>
          <label htmlFor="ctx-assignment" className="sr-only">Assignment context</label>
          <select
            id="ctx-assignment"
            value={selectedAssignment}
            onChange={(event) => setSelectedAssignment(event.target.value)}
            className="field-input max-w-[12rem] rounded-lg px-2.5 py-1.5 text-xs"
          >
            <option value="">No assignment</option>
            {assignments.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
          <label htmlFor="ctx-note" className="sr-only">Note context</label>
          <select
            id="ctx-note"
            value={selectedNote}
            onChange={(event) => setSelectedNote(event.target.value)}
            className="field-input max-w-[12rem] rounded-lg px-2.5 py-1.5 text-xs"
          >
            <option value="">No note</option>
            {notes.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </div>

        {aiConfigured === false && (
          <div className="mx-4 mt-4 flex items-start gap-2 rounded-xl bg-[var(--warn-soft)] px-4 py-3 text-sm text-[var(--warn)] sm:mx-5">
            <WarningCircle size={18} className="mt-0.5 shrink-0" />
            AI is off until an Anthropic API key is added. Everything else in StudyOS still works.
          </div>
        )}

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-6">
          {messages.length === 0 && (
            <div className="mx-auto max-w-sm py-10 text-center">
              <ChatCircleText size={28} className="mx-auto text-[var(--text-muted)]" />
              <p className="mt-3 text-sm font-medium text-[var(--text)]">Ask about anything you&apos;re studying</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Pick an assignment or a note above and the tutor will read it first.</p>
            </div>
          )}

          {messages.map((message, index) => (
            message.role === 'user' ? (
              <div key={index} className="flex justify-end">
                <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[var(--accent)] px-4 py-2.5 text-sm leading-relaxed text-[var(--on-accent)]">
                  {message.content}
                </p>
              </div>
            ) : (
              <div key={index} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-soft)] text-[var(--accent)]">
                  <ChatCircleText size={15} />
                </span>
                <p className="max-w-[68ch] whitespace-pre-wrap pt-0.5 text-[15px] leading-relaxed text-[var(--text)]">{message.content}</p>
              </div>
            )
          ))}

          {loading && (
            <div className="flex gap-3" aria-live="polite">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-soft)] text-[var(--accent)]">
                <ChatCircleText size={15} />
              </span>
              <span className="flex items-center gap-1 pt-1" aria-label="The tutor is typing">
                {[0, 1, 2].map((dot) => (
                  <span key={dot} className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--text-muted)]" style={{ animationDelay: `${dot * 160}ms` }} />
                ))}
              </span>
            </div>
          )}

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-xl bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
              <WarningCircle size={18} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(event) => { event.preventDefault(); handleSend() }}
          className="m-3 flex items-end gap-2 rounded-xl border bg-[var(--background)] p-2 focus-within:border-[var(--accent)] sm:m-4"
        >
          <label htmlFor="tutor-input" className="sr-only">Message</label>
          <textarea
            id="tutor-input"
            rows={1}
            placeholder="Ask a question"
            value={input}
            onChange={(event) => {
              setInput(event.target.value)
              event.target.style.height = 'auto'
              event.target.style.height = `${Math.min(event.target.scrollHeight, 160)}px`
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                handleSend()
              }
            }}
            className="max-h-40 min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
          />
          <button type="submit" disabled={loading || !input.trim()} aria-label="Send" className="primary-button h-9 w-9 shrink-0 rounded-lg">
            <ArrowUp size={16} weight="bold" />
          </button>
        </form>
      </section>
    </div>
  )
}

export default function TutorPage() {
  return (
    <Suspense>
      <TutorContent />
    </Suspense>
  )
}
