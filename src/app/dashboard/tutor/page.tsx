'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

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
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [note, setNote] = useState<Note | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedAssignment, setSelectedAssignment] = useState(assignmentId || '')
  const [selectedNote, setSelectedNote] = useState(noteId || '')
  const [chats, setChats] = useState<Chat[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.from('assignments').select('id, title, description').then(({ data }) => setAssignments(data || []))
    supabase.from('notes').select('id, title, content').then(({ data }) => setNotes(data || []))
    loadChats()
  }, [])

  const loadChats = async () => {
    const { data } = await supabase
      .from('ai_chats')
      .select('id, title, messages')
      .order('created_at', { ascending: false })
      .limit(20)
    setChats(data || [])
  }

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

  const deleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await supabase.from('ai_chats').delete().eq('id', chatId)
    if (currentChatId === chatId) newChat()
    loadChats()
  }

  useEffect(() => {
    if (selectedAssignment) {
      setAssignment(assignments.find(a => a.id === selectedAssignment) || null)
    } else setAssignment(null)
  }, [selectedAssignment, assignments])

  useEffect(() => {
    if (selectedNote) {
      setNote(notes.find(n => n.id === selectedNote) || null)
    } else setNote(null)
  }, [selectedNote, notes])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    const res = await fetch('/api/tutor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: newMessages, assignment, note }),
    })

    const data = await res.json()
    const updatedMessages = [...newMessages, { role: 'assistant' as const, content: data.reply }]
    setMessages(updatedMessages)
    setLoading(false)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (currentChatId) {
      await supabase.from('ai_chats').update({ messages: updatedMessages }).eq('id', currentChatId)
    } else {
      const { data: chat } = await supabase.from('ai_chats').insert({
        profile_id: user.id,
        title: userMsg.content.slice(0, 50),
        messages: updatedMessages,
        assignment_id: selectedAssignment || null,
        note_id: selectedNote || null,
      }).select().single()
      if (chat) setCurrentChatId(chat.id)
    }
    loadChats()
  }

  const selectStyle = {
    background: 'var(--surface)',
    borderColor: 'var(--border)',
    color: 'var(--text)',
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-80px)]">

      {/* 채팅 히스토리 사이드바 */}
      <div className="w-44 flex flex-col gap-1.5 overflow-y-auto flex-shrink-0">
        <button
          onClick={newChat}
          className="px-3 py-2 text-sm rounded-lg font-medium transition bg-[#4ECDC4] text-[#1c1d22] hover:bg-[#3dbdb5]"
        >
          New Chat
        </button>
        {chats.map(chat => (
          <div
            key={chat.id}
            onClick={() => loadChat(chat)}
            className="group flex items-center justify-between px-3 py-2 text-xs rounded-lg cursor-pointer transition border"
            style={{
              background: currentChatId === chat.id ? 'var(--border)' : 'transparent',
              borderColor: currentChatId === chat.id ? 'var(--border)' : 'transparent',
              color: 'var(--text-muted)',
            }}
          >
            <span className="truncate flex-1" style={{ color: 'var(--text)' }}>
              {chat.title || 'Untitled'}
            </span>
            <button
              onClick={e => deleteChat(chat.id, e)}
              className="ml-1 opacity-0 group-hover:opacity-100 transition text-red-400 hover:text-red-300"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col min-w-0">
        <h1 className="text-2xl font-semibold mb-4" style={{ color: 'var(--text)' }}>AI Tutor</h1>

        {/* 컨텍스트 선택 */}
        <div className="flex gap-3 mb-4">
          <select
            value={selectedAssignment}
            onChange={e => setSelectedAssignment(e.target.value)}
            className="text-sm border rounded-lg px-3 py-2 outline-none flex-1 transition focus:border-[#4ECDC4]"
            style={selectStyle}
          >
            <option value="">No assignment context</option>
            {assignments.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select>
          <select
            value={selectedNote}
            onChange={e => setSelectedNote(e.target.value)}
            className="text-sm border rounded-lg px-3 py-2 outline-none flex-1 transition focus:border-[#4ECDC4]"
            style={selectStyle}
          >
            <option value="">No note context</option>
            {notes.map(n => <option key={n.id} value={n.id}>{n.title}</option>)}
          </select>
        </div>

        {/* 컨텍스트 배너 */}
        {(assignment || note) && (
          <div
            className="rounded-xl px-4 py-2.5 mb-4 text-xs border"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            Context:{' '}
            {assignment && <span className="font-medium" style={{ color: 'var(--text)' }}>{assignment.title}</span>}
            {assignment && note && ' + '}
            {note && <span className="font-medium" style={{ color: 'var(--text)' }}>{note.title}</span>}
          </div>
        )}

        {/* 메시지 */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-4 mb-4">
          {messages.length === 0 && (
            <p className="text-sm text-center mt-8" style={{ color: 'var(--text-muted)' }}>
              Ask anything. Select an assignment or note for context.
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[80%] rounded-2xl px-4 py-3 text-sm"
                style={m.role === 'user'
                  ? { background: '#4ECDC4', color: '#1c1d22' }
                  : { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }
                }
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div
                className="rounded-2xl px-4 py-3 text-sm border"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                Thinking...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* 입력 */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Ask a question..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            className="flex-1 border rounded-xl px-4 py-3 text-sm outline-none transition focus:border-[#4ECDC4]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="px-4 py-3 text-sm rounded-xl font-medium transition bg-[#4ECDC4] text-[#1c1d22] hover:bg-[#3dbdb5] disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
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
