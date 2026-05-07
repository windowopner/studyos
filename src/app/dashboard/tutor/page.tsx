'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { spotlightProps } from '@/lib/spotlight'

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
  }, [])

  const loadChat = (chat: Chat) => {
    setCurrentChatId(chat.id)
    setMessages(chat.messages)
  }

  const newChat = () => {
    setCurrentChatId(null)
    setMessages([])
    setSelectedAssignment('')
    setSelectedNote('')
  }

  const deleteChat = async (chatId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    await supabase.from('ai_chats').delete().eq('id', chatId)
    if (currentChatId === chatId) newChat()
    loadChats()
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = { role: 'user', content: input }
    const newMessages = [...messages, userMessage]

    setMessages(newMessages)
    setInput('')
    setLoading(true)

    const response = await fetch('/api/tutor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: newMessages, assignment, note }),
    })

    const data = await response.json()
    const updatedMessages = [...newMessages, { role: 'assistant' as const, content: data.reply }]

    setMessages(updatedMessages)
    setLoading(false)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (currentChatId) {
      await supabase.from('ai_chats').update({ messages: updatedMessages }).eq('id', currentChatId)
    } else {
      const { data: chat } = await supabase
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
    }

    loadChats()
  }

  return (
    <div className="grid min-h-[70vh] gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="glass-panel rounded-[30px] px-4 py-4">
        <button onClick={newChat} className="primary-button w-full rounded-2xl px-4 py-3 text-sm font-semibold">
          New Chat
        </button>

        <div className="mt-4 space-y-2 overflow-y-auto pr-1">
          {chats.map((chat) => {
            const active = currentChatId === chat.id

            return (
              <button
                key={chat.id}
                onClick={() => loadChat(chat)}
                className="interactive-card flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left"
                {...spotlightProps}
                style={active ? {
                  background: 'linear-gradient(135deg, rgb(var(--accent-rgb) / 0.18), var(--surface))',
                  borderColor: 'var(--border-strong)',
                } : undefined}
              >
                <span className="relative z-10 truncate pr-2 text-xs font-medium text-[var(--text)]">
                  {chat.title || 'Untitled'}
                </span>
                <span
                  onClick={(event) => deleteChat(chat.id, event)}
                  className="relative z-10 text-xs text-red-400 hover:text-red-300"
                >
                  ×
                </span>
              </button>
            )
          })}
        </div>
      </aside>

      <section className="glass-panel flex min-w-0 flex-col rounded-[30px] px-5 py-5 sm:px-6">
        <div className="mb-5 flex flex-col gap-4">
          <div>
            <p className="page-kicker">AI Tutor</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)]">Ask with context</h1>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <select
              value={selectedAssignment}
              onChange={(event) => setSelectedAssignment(event.target.value)}
              className="field-input rounded-2xl px-4 py-3 text-sm"
            >
              <option value="">No assignment context</option>
              {assignments.map((item) => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </select>

            <select
              value={selectedNote}
              onChange={(event) => setSelectedNote(event.target.value)}
              className="field-input rounded-2xl px-4 py-3 text-sm"
            >
              <option value="">No note context</option>
              {notes.map((item) => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </select>
          </div>

          {(assignment || note) && (
            <div className="soft-badge w-fit rounded-full px-3 py-1.5 text-xs font-medium">
              Context:
              {assignment && <span className="text-[var(--text)]">{assignment.title}</span>}
              {assignment && note && <span className="text-[var(--text)]">+</span>}
              {note && <span className="text-[var(--text)]">{note.title}</span>}
            </div>
          )}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto pb-4">
          {messages.length === 0 && (
            <div className="empty-card rounded-[28px] px-6 py-10 text-center">
              <p className="text-sm text-[var(--text-muted)]">
                Ask anything. Select an assignment or note if you want extra context.
              </p>
            </div>
          )}

          {messages.map((message, index) => (
            <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[85%] rounded-[24px] px-4 py-3 text-sm leading-7"
                style={message.role === 'user'
                  ? {
                    background: 'linear-gradient(135deg, rgb(var(--accent-rgb)), rgb(var(--accent-secondary-rgb)))',
                    color: '#07111f',
                  }
                  : {
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                  }}
              >
                {message.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="interactive-card rounded-[24px] px-4 py-3 text-sm text-[var(--text-muted)]" {...spotlightProps}>
                <span className="relative z-10">Thinking...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="interactive-card mt-2 rounded-[26px] px-4 py-3" {...spotlightProps}>
          <div className="relative z-10 flex gap-3">
            <input
              type="text"
              placeholder="Ask a question..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && handleSend()}
              className="field-input w-full border-0 bg-transparent px-0 py-2 text-sm shadow-none focus-visible:shadow-none"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="primary-button rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
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
