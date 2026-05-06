'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────
type Message = {
  id: string
  content: string
  created_at: string
  profile_id: string
  deleted_at: string | null
  file_url: string | null
  file_type: string | null
  file_name: string | null
  reply_to_id: string | null
  reply_preview: string | null
  poll_id: string | null
}

type Member = {
  id: string
  profile_id: string
  role: string
  kicked_until: string | null
}

type Room = {
  id: string
  name: string
  description: string | null
  pinned_message_id: string | null
  pinned_content: string | null
  password: string | null
}

type ReactionRecord = {
  id: string
  message_id: string
  profile_id: string
  emoji: string
}

type PollRecord = {
  id: string
  question: string
  options: string[]
}

type PollVoteRecord = {
  id: string
  poll_id: string
  profile_id: string
  option_index: number
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢']
const MSG_SELECT = 'id, content, created_at, profile_id, deleted_at, file_url, file_type, file_name, reply_to_id, reply_preview, poll_id'

// ── LinkPreview ───────────────────────────────────────────────────────
function LinkPreview({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="block mt-2 border rounded-lg p-3 bg-white hover:bg-gray-50 transition max-w-xs">
      <p className="text-xs text-blue-500 truncate">{url}</p>
    </a>
  )
}

// ── MessageContent ────────────────────────────────────────────────────
function MessageContent({ message, isMe }: { message: Message; isMe: boolean }) {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  if (message.file_url) {
    if (message.file_type?.startsWith('image/')) {
      return (
        <div>
          {message.content && <p className="text-sm mb-2">{message.content}</p>}
          <img src={message.file_url} alt={message.file_name || 'image'}
            className="max-w-xs rounded-xl max-h-64 object-cover cursor-pointer"
            onClick={() => window.open(message.file_url!, '_blank')} />
        </div>
      )
    }
    if (message.file_type === 'application/pdf') {
      return (
        <div>
          {message.content && <p className="text-sm mb-2">{message.content}</p>}
          <a href={message.file_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 border rounded-lg p-3 bg-white hover:bg-gray-50 transition">
            <span className="text-red-500 text-lg">📄</span>
            <span className="text-xs text-gray-700 truncate">{message.file_name}</span>
          </a>
        </div>
      )
    }
  }
  const parts = message.content.split(urlRegex)
  const urls = message.content.match(urlRegex) || []
  return (
    <div>
      <p className="text-sm whitespace-pre-wrap">
        {parts.map((part, i) =>
          urlRegex.test(part)
            ? <a key={i} href={part} target="_blank" rel="noopener noreferrer"
                className={`underline ${isMe ? 'text-blue-300' : 'text-blue-500'}`}>{part}</a>
            : part
        )}
      </p>
      {urls.map((url, i) => <LinkPreview key={i} url={url} />)}
    </div>
  )
}

// ── PollCard ──────────────────────────────────────────────────────────
function PollCard({ poll, counts, myVote, totalVotes, onVote }: {
  poll: PollRecord; counts: Record<number, number>
  myVote: number | null; totalVotes: number; onVote: (i: number) => void
}) {
  return (
    <div className="bg-white border rounded-xl p-3 min-w-[180px] max-w-xs">
      <p className="text-sm font-medium text-gray-800 mb-3">{poll.question}</p>
      <div className="flex flex-col gap-2">
        {poll.options.map((opt, i) => {
          const pct = totalVotes > 0 ? Math.round(((counts[i] || 0) / totalVotes) * 100) : 0
          const isMyVote = myVote === i
          return (
            <button key={i} onClick={() => onVote(i)}
              className={`relative text-left rounded-lg px-3 py-2 text-xs border overflow-hidden transition ${
                isMyVote ? 'border-gray-800' : 'border-gray-200 hover:border-gray-400'}`}>
              <div className={`absolute inset-y-0 left-0 ${isMyVote ? 'bg-gray-200' : 'bg-gray-100'} transition-all`}
                style={{ width: `${pct}%` }} />
              <span className="relative flex items-center justify-between gap-2">
                <span className="text-gray-800">{opt}</span>
                <span className="text-gray-400 flex-shrink-0">{pct}%</span>
              </span>
            </button>
          )
        })}
      </div>
      <p className="text-xs text-gray-400 mt-2">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</p>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────
export default function ChatRoomPage() {
  const { id } = useParams()
  const router = useRouter()

  const [room, setRoom] = useState<Room | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [input, setInput] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [myRole, setMyRole] = useState<string>('member')
  const [loading, setLoading] = useState(true)
  const [showMembers, setShowMembers] = useState(false)
  const [kickDuration, setKickDuration] = useState<Record<string, number>>({})
  const [uploading, setUploading] = useState(false)

  // Reply
  const [replyTo, setReplyTo] = useState<{ id: string; preview: string } | null>(null)

  // Reactions
  const [reactions, setReactions] = useState<ReactionRecord[]>([])
  const [emojiPickerMsg, setEmojiPickerMsg] = useState<string | null>(null)

  // Polls
  const [polls, setPolls] = useState<Record<string, PollRecord>>({})
  const [pollVotes, setPollVotes] = useState<PollVoteRecord[]>([])
  const [showPollModal, setShowPollModal] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])

  // 메시지 삭제 모달
  const [deleteTarget, setDeleteTarget] = useState<{ message: Message; isMe: boolean } | null>(null)

  // 방 삭제 모달
  const [showDeleteRoomModal, setShowDeleteRoomModal] = useState(false)
  const [deleteRoomInput, setDeleteRoomInput] = useState('')

  const fileRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const messageIdsRef = useRef<Set<string>>(new Set())
  const pollIdsRef = useRef<Set<string>>(new Set())
  const userIdRef = useRef<string | null>(null)
  const messagesRef = useRef<Message[]>([])

  // ── Load ────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      userIdRef.current = user.id

      // is_admin 조회
      const { data: profile } = await supabase
        .from('profiles').select('is_admin').eq('id', user.id).single()
      if (profile?.is_admin) setIsAdmin(true)

      const { data: roomData } = await supabase
        .from('chat_rooms')
        .select('id, name, description, pinned_message_id, pinned_content, password')
        .eq('id', id).single()
      setRoom(roomData)

      const { data: existingMember } = await supabase
        .from('room_members').select('*').eq('room_id', id).eq('profile_id', user.id).single()

      if (!existingMember) {
        const { data: allMembers } = await supabase.from('room_members').select('role').eq('room_id', id)
        const hasOwner = allMembers?.some(m => m.role === 'owner')
        await supabase.from('room_members').insert({
          room_id: id, profile_id: user.id, role: hasOwner ? 'member' : 'owner',
        })
        setMyRole(hasOwner ? 'member' : 'owner')
      } else {
        if (existingMember.kicked_until && new Date(existingMember.kicked_until) > new Date()) {
          alert(`You are kicked until ${new Date(existingMember.kicked_until).toLocaleTimeString()}`)
          router.push('/dashboard/community')
          return
        }
        setMyRole(existingMember.role)
      }

      const { data: msgs } = await supabase
        .from('chat_messages').select(MSG_SELECT).eq('room_id', id)
        .order('created_at', { ascending: true })
      const msgList = (msgs || []) as Message[]
      setMessages(msgList)
      messageIdsRef.current = new Set(msgList.map(m => m.id))

      if (msgList.length > 0) {
        const { data: rxns } = await supabase
          .from('message_reactions').select('*').in('message_id', msgList.map(m => m.id))
        setReactions((rxns || []) as ReactionRecord[])
      }

      const pollIds = msgList.filter(m => m.poll_id).map(m => m.poll_id!)
      pollIdsRef.current = new Set(pollIds)
      if (pollIds.length > 0) {
        const { data: pollsData } = await supabase
          .from('room_polls').select('id, question, options').in('id', pollIds)
        const map: Record<string, PollRecord> = {}
        for (const p of (pollsData || [])) map[p.id] = p
        setPolls(map)
        const { data: votesData } = await supabase
          .from('poll_votes').select('*').in('poll_id', pollIds)
        setPollVotes((votesData || []) as PollVoteRecord[])
      }

      await loadMembers()
      setLoading(false)
    }
    load()

    const channel = supabase
      .channel(`room-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        async (payload) => {
          console.log('Realtime payload:', JSON.stringify(payload))
          const newId = payload.new.id as string
          if (payload.new.room_id !== id) return
          if (payload.new.profile_id === userIdRef.current) return
          const { data: msg } = await supabase.from('chat_messages').select(MSG_SELECT).eq('id', newId).single()
          if (!msg) return
          setMessages(prev => [...prev, msg as Message])
          messageIdsRef.current.add(msg.id)
          if ((msg as Message).poll_id) {
            const pollId = (msg as Message).poll_id!
            pollIdsRef.current.add(pollId)
            const { data: poll } = await supabase.from('room_polls').select('id, question, options').eq('id', pollId).single()
            if (poll) setPolls(prev => ({ ...prev, [poll.id]: poll }))
          }
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' },
        async (payload) => {
          if (payload.new.room_id !== id) return
          const updId = payload.new.id as string
          const { data: msg } = await supabase.from('chat_messages').select(MSG_SELECT).eq('id', updId).single()
          if (!msg) return
          setMessages(prev => prev.map(m => m.id === updId ? msg as Message : m))
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_rooms' },
        (payload) => {
          if (payload.new.id !== id) return
          setRoom(prev => prev ? { ...prev, ...payload.new } : prev)
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions' },
        (payload) => {
          const rxn = payload.new as ReactionRecord
          if (messageIdsRef.current.has(rxn.message_id)) setReactions(prev => [...prev, rxn])
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' },
        (payload) => {
          const old = payload.old as { id: string }
          setReactions(prev => prev.filter(r => r.id !== old.id))
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'poll_votes' },
        (payload) => {
          const vote = payload.new as PollVoteRecord
          if (pollIdsRef.current.has(vote.poll_id)) {
            setPollVotes(prev => [
              ...prev.filter(v => !(v.poll_id === vote.poll_id && v.profile_id === vote.profile_id)),
              vote,
            ])
          }
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'poll_votes' },
        (payload) => {
          const old = payload.old as { id: string }
          setPollVotes(prev => prev.filter(v => v.id !== old.id))
        })
      .subscribe((status) => { console.log('Realtime status:', status) })

    const timer = setInterval(async () => {
      const current = messagesRef.current
      const lastCreatedAt = current.length > 0 ? current[current.length - 1].created_at : new Date(0).toISOString()
      const existingIds = new Set(current.map(m => m.id))
      const { data } = await supabase
        .from('chat_messages').select(MSG_SELECT).eq('room_id', id)
        .gt('created_at', lastCreatedAt).order('created_at', { ascending: true })
      if (!data || data.length === 0) return
      const fresh = (data as Message[]).filter(m => !existingIds.has(m.id))
      if (fresh.length === 0) return
      setMessages(prev => {
        const ids = new Set(prev.map(m => m.id))
        return [...prev, ...fresh.filter(m => !ids.has(m.id))]
      })
    }, 5000)

    return () => { supabase.removeChannel(channel); clearInterval(timer) }
  }, [id])

  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ── Derived ──────────────────────────────────────────────────────────
  const canModerate = myRole === 'owner' || myRole === 'moderator' || isAdmin
  const canDeleteForEveryone = myRole === 'owner' || myRole === 'moderator' || isAdmin
  const canDeleteRoom = myRole === 'owner' || isAdmin

  const getReactionsForMsg = (msgId: string) => {
    const grouped: Record<string, { count: number; myReacted: boolean }> = {}
    for (const r of reactions.filter(r => r.message_id === msgId)) {
      if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, myReacted: false }
      grouped[r.emoji].count++
      if (r.profile_id === userId) grouped[r.emoji].myReacted = true
    }
    return grouped
  }

  const getPollData = (pollId: string) => {
    const p = polls[pollId]
    if (!p) return null
    const votes = pollVotes.filter(v => v.poll_id === pollId)
    const counts: Record<number, number> = {}
    p.options.forEach((_, i) => { counts[i] = 0 })
    votes.forEach(v => { counts[v.option_index] = (counts[v.option_index] || 0) + 1 })
    const myVote = votes.find(v => v.profile_id === userId)?.option_index ?? null
    return { ...p, counts, myVote, totalVotes: votes.length }
  }

  // ── Handlers ─────────────────────────────────────────────────────────
  const loadMembers = async () => {
    const { data } = await supabase.from('room_members').select('*').eq('room_id', id)
    setMembers(data || [])
  }

  const handleSend = async () => {
    if (!input.trim() || !userId) return
    const content = input.trim()
    const roomId = Array.isArray(id) ? id[0] : id as string
    const payload: Record<string, unknown> = { room_id: roomId, profile_id: userId, content }
    if (replyTo) { payload.reply_to_id = replyTo.id; payload.reply_preview = replyTo.preview }
    setInput('')
    const { data: inserted, error } = await supabase
      .from('chat_messages').insert(payload).select(MSG_SELECT).single()
    if (error) { setInput(content); console.error('Send failed:', error.message); return }
    setMessages(prev => [...prev, inserted as Message])
    messageIdsRef.current.add((inserted as Message).id)
    if (replyTo) setReplyTo(null)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('chat-files').upload(path, file)
    if (error) { alert('Upload failed'); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('chat-files').getPublicUrl(path)
    await supabase.from('chat_messages').insert({
      room_id: id, profile_id: userId, content: '',
      file_url: publicUrl, file_type: file.type, file_name: file.name,
    })
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  // 나에게서만 삭제 (클라이언트 상태에서만 제거)
  const handleDeleteForMe = (messageId: string) => {
    setMessages(prev => prev.filter(m => m.id !== messageId))
    setDeleteTarget(null)
  }

  // 모두에게서 삭제 (DB 업데이트)
  const handleDeleteForEveryone = async (messageId: string) => {
    await supabase.from('chat_messages')
      .update({ deleted_at: new Date().toISOString() }).eq('id', messageId)
    setDeleteTarget(null)
  }

  const handlePin = async (message: Message) => {
    const preview = message.poll_id
      ? '[Poll]'
      : (message.content.slice(0, 100) || message.file_name || 'Attachment')
    await supabase.from('chat_rooms').update({ pinned_message_id: message.id, pinned_content: preview }).eq('id', id)
    setRoom(prev => prev ? { ...prev, pinned_message_id: message.id, pinned_content: preview } : prev)
  }

  const handleUnpin = async () => {
    await supabase.from('chat_rooms').update({ pinned_message_id: null, pinned_content: null }).eq('id', id)
    setRoom(prev => prev ? { ...prev, pinned_message_id: null, pinned_content: null } : prev)
  }

  const handleKick = async (member: Member) => {
    const minutes = kickDuration[member.profile_id] || 10
    const until = new Date(Date.now() + minutes * 60 * 1000).toISOString()
    await supabase.from('room_members').update({ kicked_until: until }).eq('id', member.id)
    await loadMembers()
  }

  const handleChangeRole = async (member: Member, newRole: string) => {
    await supabase.from('room_members').update({ role: newRole }).eq('id', member.id)
    await loadMembers()
  }

  const handleTransferOwner = async (member: Member) => {
    if (!confirm('Transfer ownership to this member? You will become a Moderator.')) return
    const me = members.find(m => m.profile_id === userId)
    if (me) await supabase.from('room_members').update({ role: 'moderator' }).eq('id', me.id)
    await supabase.from('room_members').update({ role: 'owner' }).eq('id', member.id)
    setMyRole('moderator')
    await loadMembers()
  }

  const handleDeleteRoomConfirm = async () => {
    await supabase.from('chat_rooms').delete().eq('id', id)
    router.push('/dashboard/community')
  }

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!userId) return
    const existing = reactions.find(r => r.message_id === messageId && r.profile_id === userId && r.emoji === emoji)
    if (existing) {
      await supabase.from('message_reactions').delete().eq('id', existing.id)
    } else {
      await supabase.from('message_reactions').insert({ message_id: messageId, profile_id: userId, emoji })
    }
    setEmojiPickerMsg(null)
  }

  const handleSendPoll = async () => {
    if (!pollQuestion.trim() || !userId) return
    const opts = pollOptions.filter(o => o.trim())
    if (opts.length < 2) { alert('At least 2 options required'); return }
    const { data: poll } = await supabase.from('room_polls').insert({
      room_id: id, profile_id: userId, question: pollQuestion.trim(), options: opts,
    }).select().single()
    if (poll) {
      await supabase.from('chat_messages').insert({ room_id: id, profile_id: userId, content: '', poll_id: poll.id })
    }
    setShowPollModal(false); setPollQuestion(''); setPollOptions(['', ''])
  }

  const handleVote = async (pollId: string, optionIndex: number) => {
    if (!userId) return
    const existing = pollVotes.find(v => v.poll_id === pollId && v.profile_id === userId)
    if (existing) {
      await supabase.from('poll_votes').delete().eq('id', existing.id)
      if (existing.option_index === optionIndex) return
    }
    await supabase.from('poll_votes').insert({ poll_id: pollId, profile_id: userId, option_index: optionIndex })
  }

  const handleCopyInvite = () => {
    const url = window.location.href
    const text = room?.password ? `${url}\nPassword: ${room.password}` : url
    navigator.clipboard.writeText(text).then(() => alert('Invite link copied!')).catch(() => alert('Failed to copy'))
  }

  const handleExportChat = () => {
    const lines = messages.filter(m => !m.deleted_at).map(m => {
      const time = new Date(m.created_at).toLocaleString()
      const who = m.profile_id === userId ? 'You' : 'Anonymous'
      if (m.poll_id) return `[${time}] ${who}: [Poll]`
      if (m.file_url) return `[${time}] ${who}: [File: ${m.file_name || m.file_url}]`
      return `[${time}] ${who}: ${m.content}`
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${room?.name || 'chat'}-export.txt`
    a.click()
  }

  if (loading) return <div className="text-sm text-gray-400">Loading...</div>
  if (!room) return <div className="text-sm text-gray-400">Room not found.</div>

  return (
    <div className="flex h-[calc(100vh-64px)] gap-4">
      {emojiPickerMsg && (
        <div className="fixed inset-0 z-[5]" onClick={() => setEmojiPickerMsg(null)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/community" className="text-xs text-gray-400 hover:text-gray-600">Back</Link>
            <div>
              <h1 className="text-lg font-semibold">{room.name}</h1>
              {room.description && <p className="text-xs text-gray-400">{room.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCopyInvite} className="text-xs px-3 py-1.5 border rounded-lg hover:bg-gray-50 transition">
              🔗 Invite
            </button>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              myRole === 'owner' ? 'bg-yellow-100 text-yellow-700' :
              myRole === 'moderator' ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {myRole === 'owner' ? 'Owner' : myRole === 'moderator' ? 'Moderator' : 'Member'}
              {isAdmin && ' · Admin'}
            </span>
            <button
              onClick={() => { setShowMembers(!showMembers); loadMembers() }}
              className="text-xs px-3 py-1.5 border rounded-lg hover:bg-gray-50 transition"
            >
              Members ({members.length})
            </button>
          </div>
        </div>

        {/* Pinned banner */}
        {room.pinned_message_id && room.pinned_content && (
          <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2 mb-3">
            <span className="text-xs">📌</span>
            <p className="text-xs text-gray-700 flex-1 truncate">{room.pinned_content}</p>
            {canModerate && (
              <button onClick={handleUnpin} className="text-xs text-gray-400 hover:text-gray-600 flex-shrink-0">✕</button>
            )}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-3 mb-4">
          {messages.length === 0 && (
            <p className="text-sm text-gray-400 text-center mt-8">No messages yet.</p>
          )}
          {messages.map(m => {
            const isMe = m.profile_id === userId
            if (m.deleted_at) {
              return (
                <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <span className="text-xs text-gray-300 italic px-4 py-2">Message deleted</span>
                </div>
              )
            }

            const msgReactions = getReactionsForMsg(m.id)
            const pollData = m.poll_id ? getPollData(m.poll_id) : null

            const actionButtons = (side: 'left' | 'right') => (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                {canModerate && (
                  <button onClick={() => handlePin(m)} title="Pin"
                    className="text-xs text-gray-400 hover:text-yellow-500 p-1.5 rounded hover:bg-gray-100 transition">
                    📌
                  </button>
                )}
                <div className="relative z-[6]">
                  <button
                    onClick={e => { e.stopPropagation(); setEmojiPickerMsg(emojiPickerMsg === m.id ? null : m.id) }}
                    className="text-xs text-gray-400 hover:text-gray-600 p-1.5 rounded hover:bg-gray-100 transition"
                  >
                    😊
                  </button>
                  {emojiPickerMsg === m.id && (
                    <div
                      className={`absolute bottom-full mb-1 ${side === 'right' ? 'left-0' : 'right-0'} flex gap-1 bg-white border rounded-xl shadow-lg px-2 py-1.5 z-[10]`}
                      onClick={e => e.stopPropagation()}
                    >
                      {EMOJIS.map(e => (
                        <button key={e} onClick={() => handleReaction(m.id, e)}
                          className="text-base hover:scale-125 transition-transform">{e}</button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setReplyTo({
                    id: m.id,
                    preview: m.poll_id ? '[Poll]' : (m.content.slice(0, 80) || m.file_name || 'Attachment'),
                  })}
                  className="text-xs text-gray-400 hover:text-gray-600 p-1.5 rounded hover:bg-gray-100 transition"
                >
                  ↩
                </button>
                {(canModerate || isMe) && (
                  <button
                    onClick={() => setDeleteTarget({ message: m, isMe })}
                    className="text-xs text-gray-400 hover:text-red-400 p-1.5 rounded hover:bg-gray-100 transition"
                  >
                    ✕
                  </button>
                )}
              </div>
            )

            return (
              <div key={m.id} className={`flex items-end gap-2 group ${isMe ? 'justify-end' : 'justify-start'}`}>
                {!isMe && (
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs text-gray-400">?</span>
                  </div>
                )}
                <div className={`max-w-[70%] flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-xs text-gray-400 px-1">{isMe ? 'You' : 'Anonymous'}</span>
                  {m.reply_preview && (
                    <div className="text-xs px-3 py-1 rounded-lg mb-0.5 border-l-2 border-gray-400 bg-gray-50 text-gray-500 max-w-full truncate">
                      ↩ {m.reply_preview}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    {isMe && actionButtons('left')}
                    <div className={`rounded-2xl px-4 py-2.5 text-sm ${isMe ? 'bg-black text-white' : 'bg-gray-100 text-gray-800'}`}>
                      {pollData ? (
                        <PollCard poll={pollData} counts={pollData.counts} myVote={pollData.myVote}
                          totalVotes={pollData.totalVotes} onVote={i => handleVote(m.poll_id!, i)} />
                      ) : m.poll_id ? (
                        <p className="text-xs text-gray-400">Loading poll...</p>
                      ) : (
                        <MessageContent message={m} isMe={isMe} />
                      )}
                    </div>
                    {!isMe && actionButtons('right')}
                  </div>
                  {Object.keys(msgReactions).length > 0 && (
                    <div className="flex flex-wrap gap-1 px-1 mt-0.5">
                      {Object.entries(msgReactions).map(([emoji, { count, myReacted }]) => (
                        <button key={emoji} onClick={() => handleReaction(m.id, emoji)}
                          className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full border transition ${
                            myReacted ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 hover:border-gray-400'
                          }`}>
                          {emoji} <span>{count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <span className="text-xs text-gray-400 px-1">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Reply bar */}
        {replyTo && (
          <div className="flex items-center gap-2 bg-gray-50 border rounded-xl px-3 py-2 mb-2">
            <span className="text-xs text-gray-500 flex-1 truncate">↩ Replying to: {replyTo.preview}</span>
            <button onClick={() => setReplyTo(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2 items-center">
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="px-3 py-3 border rounded-xl text-sm hover:bg-gray-50 transition disabled:opacity-40 flex-shrink-0">
            {uploading ? '...' : '📎'}
          </button>
          <button onClick={() => setShowPollModal(true)} title="Create poll"
            className="px-3 py-3 border rounded-xl text-sm hover:bg-gray-50 transition flex-shrink-0">
            📊
          </button>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileUpload} />
          <input type="text" placeholder="Type a message..." value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            className="flex-1 border rounded-xl px-4 py-3 text-sm outline-none" />
          <button onClick={handleSend} disabled={!input.trim()}
            className="px-4 py-3 bg-black text-white text-sm rounded-xl hover:bg-gray-800 transition disabled:opacity-40">
            Send
          </button>
        </div>
      </div>

      {/* Members panel */}
      {showMembers && (
        <div className="w-60 border-l pl-4 flex flex-col">
          <h2 className="text-sm font-medium mb-3">Members</h2>
          <div className="flex flex-col gap-3 overflow-y-auto flex-1">
            {members.map(m => {
              const isKicked = m.kicked_until && new Date(m.kicked_until) > new Date()
              const isMe = m.profile_id === userId
              return (
                <div key={m.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="text-xs font-medium">{isMe ? 'You' : 'Anonymous'}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        m.role === 'owner' ? 'bg-yellow-100 text-yellow-700' :
                        m.role === 'moderator' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {m.role === 'owner' ? 'Owner' : m.role === 'moderator' ? 'Mod' : 'Member'}
                      </span>
                    </div>
                  </div>
                  {isKicked && (
                    <p className="text-xs text-red-400">
                      Kicked until {new Date(m.kicked_until!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                  {canModerate && !isMe && m.role !== 'owner' && (
                    <div className="flex flex-col gap-1">
                      <select value={m.role} onChange={e => handleChangeRole(m, e.target.value)}
                        className="text-xs border rounded px-1 py-0.5 outline-none">
                        <option value="member">Member</option>
                        <option value="moderator">Moderator</option>
                      </select>
                      <div className="flex items-center gap-1">
                        <input type="number" min={1} max={1440}
                          value={kickDuration[m.profile_id] || 10}
                          onChange={e => setKickDuration(prev => ({ ...prev, [m.profile_id]: Number(e.target.value) }))}
                          className="w-12 text-xs border rounded px-1 py-0.5 outline-none" />
                        <span className="text-xs text-gray-400">min</span>
                        <button onClick={() => handleKick(m)} className="text-xs text-red-400 hover:text-red-600 transition">Kick</button>
                      </div>
                      {myRole === 'owner' && (
                        <button onClick={() => handleTransferOwner(m)}
                          className="text-xs text-yellow-600 hover:text-yellow-800 transition text-left">
                          Transfer Owner
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="flex flex-col gap-1 pt-3 mt-3 border-t">
            <button onClick={handleCopyInvite}
              className="text-xs text-left px-2 py-1.5 rounded hover:bg-gray-50 transition text-gray-600">
              🔗 Copy invite link
            </button>
            {(myRole === 'owner' || isAdmin) && (
              <button onClick={handleExportChat}
                className="text-xs text-left px-2 py-1.5 rounded hover:bg-gray-50 transition text-gray-600">
                ⬇️ Export chat
              </button>
            )}
            {canDeleteRoom && (
              <button
                onClick={() => { setDeleteRoomInput(''); setShowDeleteRoomModal(true) }}
                className="text-xs text-left px-2 py-1.5 rounded hover:bg-gray-50 transition text-red-500"
              >
                🗑 Delete room
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── 메시지 삭제 모달 ── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-80 flex flex-col gap-3">
            <h2 className="text-base font-semibold">Delete message?</h2>
            <p className="text-xs text-gray-500 border rounded-xl px-3 py-2 bg-gray-50 line-clamp-2">
              {deleteTarget.message.content || (deleteTarget.message.file_name ?? '[Attachment]')}
            </p>
            <button
              onClick={() => handleDeleteForMe(deleteTarget.message.id)}
              className="w-full px-4 py-2.5 border text-sm rounded-xl hover:bg-gray-50 transition text-left"
            >
              나에게서만 삭제
              <span className="block text-xs text-gray-400 mt-0.5">내 화면에서만 사라집니다.</span>
            </button>
            {canDeleteForEveryone && (
              <button
                onClick={() => handleDeleteForEveryone(deleteTarget.message.id)}
                className="w-full px-4 py-2.5 bg-red-500 text-white text-sm rounded-xl hover:bg-red-600 transition text-left"
              >
                Delete for everyone
                <span className="block text-xs text-red-200 mt-0.5">모든 사람의 화면에서 삭제됩니다.</span>
              </button>
            )}
            <button
              onClick={() => setDeleteTarget(null)}
              className="text-xs text-gray-400 hover:text-gray-600 transition text-center"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── 방 삭제 모달 ── */}
      {showDeleteRoomModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-80 flex flex-col gap-4">
            <div>
              <h2 className="text-base font-semibold text-red-500">Delete Room</h2>
              <p className="text-xs text-gray-500 mt-1">
                이 작업은 되돌릴 수 없습니다. 계속하려면 방 이름을 입력하세요.
              </p>
            </div>
            <div className="bg-gray-50 border rounded-lg px-3 py-2 text-sm font-medium text-gray-700">
              {room.name}
            </div>
            <input
              type="text"
              placeholder="방 이름 입력..."
              value={deleteRoomInput}
              onChange={e => setDeleteRoomInput(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteRoomModal(false)}
                className="flex-1 px-4 py-2 border text-sm rounded-xl hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteRoomConfirm}
                disabled={deleteRoomInput !== room.name}
                className="flex-1 px-4 py-2 bg-red-500 text-white text-sm rounded-xl hover:bg-red-600 transition disabled:opacity-40"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Poll modal */}
      {showPollModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowPollModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-96" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Create Poll</h2>
            <input placeholder="Question" value={pollQuestion} onChange={e => setPollQuestion(e.target.value)}
              className="w-full border rounded-xl px-3 py-2 text-sm outline-none mb-3 focus:border-gray-400" />
            <div className="flex flex-col gap-2 mb-2">
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input placeholder={`Option ${i + 1}`} value={opt}
                    onChange={e => setPollOptions(prev => prev.map((o, j) => j === i ? e.target.value : o))}
                    className="flex-1 border rounded-xl px-3 py-2 text-sm outline-none focus:border-gray-400" />
                  {pollOptions.length > 2 && (
                    <button onClick={() => setPollOptions(prev => prev.filter((_, j) => j !== i))}
                      className="text-xs text-gray-400 hover:text-red-400 transition">✕</button>
                  )}
                </div>
              ))}
            </div>
            {pollOptions.length < 4 && (
              <button onClick={() => setPollOptions(prev => [...prev, ''])}
                className="text-xs text-gray-400 hover:text-gray-600 mb-4 transition">
                + Add option
              </button>
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowPollModal(false)}
                className="flex-1 px-4 py-2 border text-sm rounded-xl hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleSendPoll}
                disabled={!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2}
                className="flex-1 px-4 py-2 bg-black text-white text-sm rounded-xl hover:bg-gray-800 transition disabled:opacity-40">
                Send Poll
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
