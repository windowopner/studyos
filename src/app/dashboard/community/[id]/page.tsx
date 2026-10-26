'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowBendUpLeft,
  ArrowLeft,
  ChartBar,
  DownloadSimple,
  FileText,
  LinkSimple,
  Lock,
  Paperclip,
  PaperPlaneRight,
  PushPin,
  Smiley,
  Trash,
  UsersThree,
  X,
} from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/components/toaster'
import Modal from '@/components/modal'
import LoadError from '@/components/load-error'

// Rooms are anonymous: everyone else shows as "Anonymous". Everything that changes a room
// (joining, pinning, roles, kicks, deleting) goes through database functions that check the
// caller's role; see supabase/migrations/20261014000300_community_rooms.sql.

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

type Member = { id: string; profile_id: string; role: string; kicked_until: string | null }
type Room = { id: string; name: string; description: string | null; pinned_message_id: string | null; pinned_content: string | null; has_password: boolean }
type Reaction = { id: string; message_id: string; profile_id: string; emoji: string }
type Poll = { id: string; question: string; options: string[] }
type Vote = { id: string; poll_id: string; profile_id: string; option_index: number }
type JoinResult = { status: 'joined' | 'kicked' | 'password_required' | 'wrong_password'; role?: string; kicked_until?: string }

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢']
const MSG_SELECT = 'id, content, created_at, profile_id, deleted_at, file_url, file_type, file_name, reply_to_id, reply_preview, poll_id'
const FILE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']
// Chat files are private: file_url is a storage path, shown through a signed link that lasts
// an hour and is renewed before it runs out.
const FILE_LINK_SECONDS = 60 * 60
const FILE_LINK_RENEW_MS = 50 * 60 * 1000
const URL_PATTERN = /(https?:\/\/[^\s]+)/g

const roleLabel = (role: string) => (role === 'owner' ? 'Owner' : role === 'moderator' ? 'Moderator' : 'Member')
const roleStyle = (role: string) =>
  role === 'owner'
    ? 'bg-[var(--warn-soft)] text-[var(--warn)]'
    : role === 'moderator'
      ? 'bg-[rgb(var(--accent-rgb)/0.12)] text-[var(--accent)]'
      : 'bg-[var(--surface-soft)] text-[var(--text-muted)]'

const previewOf = (message: Message) =>
  message.poll_id ? '[Poll]' : (message.content.slice(0, 80) || message.file_name || 'Attachment')

function MessageContent({ message, fileLink }: { message: Message; fileLink?: string }) {
  if (message.file_url && message.file_type?.startsWith('image/')) {
    return (
      <div>
        {message.content && <p className="mb-2 text-sm">{message.content}</p>}
        {fileLink ? (
          <a href={fileLink} target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fileLink} alt={message.file_name || 'Image'} className="max-h-64 max-w-full rounded-xl object-cover sm:max-w-xs" />
          </a>
        ) : (
          <div className="h-40 w-56 max-w-full animate-pulse rounded-xl bg-[var(--surface-soft)]" />
        )}
      </div>
    )
  }
  if (message.file_url) {
    return (
      <a href={fileLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg border bg-[var(--surface)] p-3 hover:bg-[var(--surface-hover)]">
        <FileText size={20} className="shrink-0 text-[var(--danger)]" />
        <span className="truncate text-xs text-[var(--text)]">{message.file_name || 'File'}</span>
      </a>
    )
  }
  const parts = message.content.split(URL_PATTERN)
  return (
    <p className="whitespace-pre-wrap break-words text-sm">
      {parts.map((part, index) =>
        index % 2 === 1
          ? <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{part}</a>
          : part
      )}
    </p>
  )
}

function PollCard({ poll, votes, userId, onVote }: { poll: Poll; votes: Vote[]; userId: string | null; onVote: (index: number) => void }) {
  const total = votes.length
  const mine = votes.find((vote) => vote.profile_id === userId)?.option_index ?? null
  return (
    <div className="w-full min-w-0">
      <p className="mb-3 text-sm font-medium">{poll.question}</p>
      <div className="flex flex-col gap-2">
        {poll.options.map((option, index) => {
          const count = votes.filter((vote) => vote.option_index === index).length
          const percent = total > 0 ? Math.round((count / total) * 100) : 0
          return (
            <button
              key={index}
              onClick={() => onVote(index)}
              aria-pressed={mine === index}
              className={`relative overflow-hidden rounded-lg border px-3 py-2 text-left text-xs ${mine === index ? 'border-[var(--accent)]' : 'hover:border-[var(--border-strong)]'}`}
            >
              <span className="absolute inset-y-0 left-0 bg-[rgb(var(--accent-rgb)/0.14)] transition-[width] duration-500" style={{ width: `${percent}%` }} />
              <span className="relative flex items-center justify-between gap-2">
                <span className="text-[var(--text)]">{option}</span>
                <span className="shrink-0 font-mono text-[var(--text-muted)]">{percent}%</span>
              </span>
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-[var(--text-muted)]">{total} vote{total === 1 ? '' : 's'}</p>
    </div>
  )
}

export default function ChatRoomPage() {
  const params = useParams<{ id: string }>()
  const roomId = params.id
  const router = useRouter()

  const [room, setRoom] = useState<Room | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [polls, setPolls] = useState<Record<string, Poll>>({})
  const [votes, setVotes] = useState<Vote[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [myRole, setMyRole] = useState('member')
  const [phase, setPhase] = useState<'loading' | 'locked' | 'ready' | 'missing' | 'failed'>('loading')
  const [attempt, setAttempt] = useState(0)

  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [replyTo, setReplyTo] = useState<{ id: string; preview: string } | null>(null)
  const [emojiFor, setEmojiFor] = useState<string | null>(null)
  const [showMembers, setShowMembers] = useState(false)
  const [kickMinutes, setKickMinutes] = useState<Record<string, number>>({})
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null)
  const [showDeleteRoom, setShowDeleteRoom] = useState(false)
  const [deleteRoomInput, setDeleteRoomInput] = useState('')
  const [showPoll, setShowPoll] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [fileLinks, setFileLinks] = useState<Record<string, string>>({})

  const fileRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<Message[]>([])
  const pollIdsRef = useRef<Set<string>>(new Set())
  const signedPathsRef = useRef<Set<string>>(new Set())

  useEffect(() => { messagesRef.current = messages }, [messages])

  const signFiles = async (list: Message[], renew = false) => {
    const paths = [...new Set(list.map((message) => message.file_url).filter((path): path is string => !!path))]
      .filter((path) => renew || !signedPathsRef.current.has(path))
    if (paths.length === 0) return
    paths.forEach((path) => signedPathsRef.current.add(path))
    const { data } = await supabase.storage.from('chat-files').createSignedUrls(paths, FILE_LINK_SECONDS)
    const signed = (data || []).filter((item) => item.path && item.signedUrl)
    // Leave anything that failed unmarked so the next pass tries it again.
    paths.filter((path) => !signed.some((item) => item.path === path)).forEach((path) => signedPathsRef.current.delete(path))
    if (signed.length) setFileLinks((previous) => ({ ...previous, ...Object.fromEntries(signed.map((item) => [item.path!, item.signedUrl!])) }))
  }

  useEffect(() => { signFiles(messages) }, [messages])

  // Keep the newest message in view, unless you've scrolled up to read older ones.
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    if (list.scrollHeight - list.scrollTop - list.clientHeight < 160) list.scrollTop = list.scrollHeight
  }, [messages])

  const addMessages = (incoming: Message[]) => {
    if (incoming.length === 0) return
    setMessages((previous) => {
      const known = new Set(previous.map((message) => message.id))
      const fresh = incoming.filter((message) => !known.has(message.id))
      return fresh.length ? [...previous, ...fresh].sort((a, b) => a.created_at.localeCompare(b.created_at)) : previous
    })
  }

  const loadPolls = async (pollIds: string[]) => {
    const missing = pollIds.filter((id) => !pollIdsRef.current.has(id))
    if (missing.length === 0) return
    missing.forEach((id) => pollIdsRef.current.add(id))
    const [{ data: pollData }, { data: voteData }] = await Promise.all([
      supabase.from('room_polls').select('id, question, options').in('id', missing),
      supabase.from('poll_votes').select('id, poll_id, profile_id, option_index').in('poll_id', missing),
    ])
    setPolls((previous) => ({ ...previous, ...Object.fromEntries((pollData || []).map((poll) => [poll.id, poll as Poll])) }))
    setVotes((previous) => [...previous.filter((vote) => !missing.includes(vote.poll_id)), ...((voteData || []) as Vote[])])
  }

  const loadMembers = async () => {
    const { data } = await supabase.from('room_members').select('id, profile_id, role, kicked_until').eq('room_id', roomId).order('joined_at')
    setMembers(data || [])
  }

  // ── Load: room, join, then messages ────────────────────────────────
  useEffect(() => {
    let alive = true
    pollIdsRef.current = new Set()

    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user || !alive) return
      setUserId(user.id)

      const [{ data: profile }, roomRes] = await Promise.all([
        supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle(),
        supabase.from('chat_rooms').select('id, name, description, pinned_message_id, pinned_content, has_password').eq('id', roomId).maybeSingle(),
      ])
      if (!alive) return
      setIsAdmin(!!profile?.is_admin)
      if (roomRes.error && roomRes.error.code !== '22P02') { setPhase('failed'); return }
      if (!roomRes.data) { setPhase('missing'); return }
      setRoom(roomRes.data)

      const { data: joinData, error: joinError } = await supabase.rpc('join_room', { p_room: roomId, p_password: null })
      if (!alive) return
      if (joinError) { setPhase('failed'); return }
      const joined = joinData as JoinResult
      if (joined.status === 'kicked') {
        toast(`You can rejoin this room at ${new Date(joined.kicked_until!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`, 'error')
        router.replace('/dashboard/community')
        return
      }
      if (joined.status !== 'joined') { setPhase('locked'); return }
      setMyRole(joined.role || 'member')

      const { data: messageData, error: messageError } = await supabase
        .from('chat_messages').select(MSG_SELECT).eq('room_id', roomId).order('created_at', { ascending: true }).limit(500)
      if (!alive) return
      if (messageError) { setPhase('failed'); return }
      const list = (messageData || []) as Message[]
      setMessages(list)

      const ids = list.map((message) => message.id)
      const [{ data: reactionData }] = await Promise.all([
        ids.length ? supabase.from('message_reactions').select('id, message_id, profile_id, emoji').in('message_id', ids) : Promise.resolve({ data: [] }),
        loadPolls(list.filter((message) => message.poll_id).map((message) => message.poll_id!)),
        loadMembers(),
      ])
      if (!alive) return
      setReactions((reactionData || []) as Reaction[])
      setPhase('ready')
      requestAnimationFrame(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight })
    }

    load()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, attempt])

  // ── Live updates once you're in ────────────────────────────────────
  useEffect(() => {
    if (phase !== 'ready') return

    const channel = supabase
      .channel(`room-${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` }, (payload) => {
        const message = payload.new as Message
        addMessages([message])
        if (message.poll_id) loadPolls([message.poll_id])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` }, (payload) => {
        const message = payload.new as Message
        setMessages((previous) => previous.map((item) => (item.id === message.id ? message : item)))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions' }, (payload) => {
        const reaction = payload.new as Reaction
        if (!messagesRef.current.some((message) => message.id === reaction.message_id)) return
        setReactions((previous) => (previous.some((item) => item.id === reaction.id) ? previous : [...previous, reaction]))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' }, (payload) => {
        const old = payload.old as { id: string }
        setReactions((previous) => previous.filter((item) => item.id !== old.id))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'poll_votes' }, (payload) => {
        const vote = payload.new as Vote
        if (!pollIdsRef.current.has(vote.poll_id)) return
        setVotes((previous) => [...previous.filter((item) => item.id !== vote.id && !(item.poll_id === vote.poll_id && item.profile_id === vote.profile_id)), vote])
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'poll_votes' }, (payload) => {
        const old = payload.old as { id: string }
        setVotes((previous) => previous.filter((item) => item.id !== old.id))
      })
      .subscribe()

    // Fallback in case the live connection drops: every 5 seconds, fetch anything newer,
    // and refresh the pinned message.
    const timer = setInterval(async () => {
      if (document.hidden) return
      const current = messagesRef.current
      const last = current.length ? current[current.length - 1].created_at : new Date(0).toISOString()
      const [{ data }, { data: roomData }] = await Promise.all([
        supabase.from('chat_messages').select(MSG_SELECT).eq('room_id', roomId).gt('created_at', last).order('created_at', { ascending: true }),
        supabase.from('chat_rooms').select('pinned_message_id, pinned_content').eq('id', roomId).maybeSingle(),
      ])
      if (data?.length) {
        addMessages(data as Message[])
        const pollIds = (data as Message[]).filter((message) => message.poll_id).map((message) => message.poll_id!)
        if (pollIds.length) loadPolls(pollIds)
      }
      if (roomData) setRoom((previous) => (previous ? { ...previous, ...roomData } : previous))
    }, 5000)

    const renewLinks = setInterval(() => signFiles(messagesRef.current, true), FILE_LINK_RENEW_MS)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(timer)
      clearInterval(renewLinks)
    }
  }, [phase, roomId])

  const isModerator = myRole === 'owner' || myRole === 'moderator' || isAdmin
  const isOwner = myRole === 'owner' || isAdmin

  // ── Actions ────────────────────────────────────────────────────────
  const unlock = async () => {
    if (!password) return
    const { data, error } = await supabase.rpc('join_room', { p_room: roomId, p_password: password })
    if (error) { toast(error.message, 'error'); return }
    if ((data as JoinResult).status === 'wrong_password') { setPasswordError('That password isn’t right.'); return }
    setPassword('')
    setPhase('loading')
    setAttempt((value) => value + 1)
  }

  const handleSend = async () => {
    const content = input.trim()
    if (!content || !userId || sending) return
    setSending(true)
    setInput('')
    const payload: Record<string, unknown> = { room_id: roomId, profile_id: userId, content: content.slice(0, 4000) }
    if (replyTo) { payload.reply_to_id = replyTo.id; payload.reply_preview = replyTo.preview }
    const { data, error } = await supabase.from('chat_messages').insert(payload).select(MSG_SELECT).single()
    setSending(false)
    if (error) { setInput(content); toast(error.message, 'error'); return }
    addMessages([data as Message])
    setReplyTo(null)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !userId) return
    if (!FILE_TYPES.includes(file.type)) { toast('You can share images (PNG, JPG, WebP, GIF) and PDFs.', 'error'); return }
    if (file.size > 10 * 1024 * 1024) { toast('Files can be up to 10 MB.', 'error'); return }

    setUploading(true)
    const extension = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '') : 'bin'
    const path = `${roomId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`
    const { error } = await supabase.storage.from('chat-files').upload(path, file, { contentType: file.type })
    if (error) { toast(`Upload failed: ${error.message}`, 'error'); setUploading(false); return }
    const { data, error: insertError } = await supabase.from('chat_messages').insert({
      room_id: roomId, profile_id: userId, content: '', file_url: path, file_type: file.type, file_name: file.name.slice(0, 200),
    }).select(MSG_SELECT).single()
    setUploading(false)
    if (insertError) { toast(insertError.message, 'error'); return }
    addMessages([data as Message])
  }

  const hideForMe = (message: Message) => {
    setHiddenIds((previous) => new Set(previous).add(message.id))
    setDeleteTarget(null)
  }

  const deleteForEveryone = async (message: Message) => {
    const { error } = await supabase.rpc('delete_message', { p_message: message.id })
    setDeleteTarget(null)
    if (error) { toast(error.message, 'error'); return }
    setMessages((previous) => previous.map((item) => (item.id === message.id ? { ...item, deleted_at: new Date().toISOString(), content: '', file_url: null } : item)))
    if (room?.pinned_message_id === message.id) setRoom({ ...room, pinned_message_id: null, pinned_content: null })
  }

  const setPinned = async (message: Message | null) => {
    const { error } = await supabase.rpc('set_pinned_message', { p_room: roomId, p_message: message?.id ?? null })
    if (error) { toast(error.message, 'error'); return }
    setRoom((previous) => previous ? {
      ...previous,
      pinned_message_id: message?.id ?? null,
      pinned_content: message ? (message.poll_id ? '[Poll]' : message.content.slice(0, 100) || message.file_name || 'Attachment') : null,
    } : previous)
  }

  const kick = async (member: Member) => {
    const { error } = await supabase.rpc('kick_member', { p_member: member.id, p_minutes: kickMinutes[member.id] || 10 })
    if (error) { toast(error.message, 'error'); return }
    toast('Member kicked.', 'success')
    loadMembers()
  }

  const changeRole = async (member: Member, role: string) => {
    if (role === 'owner' && !confirm('Hand ownership to this member? You will become a moderator.')) return
    const { error } = await supabase.rpc('set_member_role', { p_member: member.id, p_role: role })
    if (error) { toast(error.message, 'error'); return }
    if (role === 'owner' && !isAdmin) setMyRole('moderator')
    loadMembers()
  }

  const deleteRoom = async () => {
    const { error } = await supabase.rpc('delete_room', { p_room: roomId })
    if (error) { toast(error.message, 'error'); return }
    toast('Room deleted.', 'success')
    router.push('/dashboard/community')
  }

  const react = async (messageId: string, emoji: string) => {
    if (!userId) return
    setEmojiFor(null)
    const existing = reactions.find((item) => item.message_id === messageId && item.profile_id === userId && item.emoji === emoji)
    if (existing) {
      setReactions((previous) => previous.filter((item) => item.id !== existing.id))
      const { error } = await supabase.from('message_reactions').delete().eq('id', existing.id)
      if (error) { toast(error.message, 'error'); setReactions((previous) => [...previous, existing]) }
      return
    }
    const { data, error } = await supabase.from('message_reactions').insert({ message_id: messageId, profile_id: userId, emoji }).select('id, message_id, profile_id, emoji').single()
    if (error) { toast(error.message, 'error'); return }
    setReactions((previous) => (previous.some((item) => item.id === data.id) ? previous : [...previous, data as Reaction]))
  }

  const sendPoll = async () => {
    const options = pollOptions.map((option) => option.trim()).filter(Boolean)
    if (!pollQuestion.trim() || options.length < 2 || !userId) return
    const { data: poll, error } = await supabase.from('room_polls').insert({
      room_id: roomId, profile_id: userId, question: pollQuestion.trim().slice(0, 200), options: options.map((option) => option.slice(0, 100)),
    }).select('id, question, options').single()
    if (error || !poll) { toast(error?.message || 'Could not create the poll.', 'error'); return }
    pollIdsRef.current.add(poll.id)
    setPolls((previous) => ({ ...previous, [poll.id]: poll as Poll }))
    const { data, error: messageError } = await supabase.from('chat_messages').insert({ room_id: roomId, profile_id: userId, content: '', poll_id: poll.id }).select(MSG_SELECT).single()
    if (messageError) { toast(messageError.message, 'error'); return }
    addMessages([data as Message])
    setShowPoll(false)
    setPollQuestion('')
    setPollOptions(['', ''])
  }

  const vote = async (pollId: string, optionIndex: number) => {
    if (!userId) return
    const existing = votes.find((item) => item.poll_id === pollId && item.profile_id === userId)
    if (existing) {
      setVotes((previous) => previous.filter((item) => item.id !== existing.id))
      const { error } = await supabase.from('poll_votes').delete().eq('id', existing.id)
      if (error) { toast(error.message, 'error'); setVotes((previous) => [...previous, existing]); return }
      if (existing.option_index === optionIndex) return
    }
    const { data, error } = await supabase.from('poll_votes').insert({ poll_id: pollId, profile_id: userId, option_index: optionIndex }).select('id, poll_id, profile_id, option_index').single()
    if (error) { toast(error.message, 'error'); return }
    setVotes((previous) => [...previous.filter((item) => !(item.poll_id === pollId && item.profile_id === userId)), data as Vote])
  }

  const copyInvite = () => {
    const text = room?.has_password ? `${window.location.href}\n(This room has a password. Share it separately.)` : window.location.href
    navigator.clipboard.writeText(text).then(() => toast('Invite link copied.', 'success')).catch(() => toast('Could not copy the link.', 'error'))
  }

  const exportChat = () => {
    const lines = messages.filter((message) => !message.deleted_at).map((message) => {
      const time = new Date(message.created_at).toLocaleString()
      const who = message.profile_id === userId ? 'You' : 'Anonymous'
      if (message.poll_id) return `[${time}] ${who}: [Poll] ${polls[message.poll_id]?.question || ''}`
      if (message.file_url) return `[${time}] ${who}: [File: ${message.file_name || 'Attachment'}]`
      return `[${time}] ${who}: ${message.content}`
    })
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${room?.name || 'chat'}-export.txt`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // ── States before the room is open ─────────────────────────────────
  const back = (
    <Link href="/dashboard/community" aria-label="Back to rooms" className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]">
      <ArrowLeft size={18} />
    </Link>
  )

  if (phase === 'loading') {
    return (
      <div className="space-y-3">
        <div className="skeleton h-8 w-1/3" />
        <div className="skeleton h-[60dvh] rounded-2xl" />
      </div>
    )
  }
  if (phase === 'failed') {
    return <LoadError message="This room couldn’t load. Check your connection and try again." onRetry={() => { setPhase('loading'); setAttempt((value) => value + 1) }} />
  }
  if (phase === 'missing' || !room) {
    return (
      <div className="empty-card rounded-2xl px-6 py-14 text-center">
        <p className="text-sm font-medium text-[var(--text)]">Room not found</p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">It may have been deleted.</p>
        <Link href="/dashboard/community" className="mt-3 inline-block text-sm text-[var(--accent)] hover:underline">Back to rooms</Link>
      </div>
    )
  }
  if (phase === 'locked') {
    return (
      <div className="mx-auto max-w-sm py-10">
        <div className="mb-6 flex items-center gap-2">{back}<h1 className="text-lg font-semibold text-[var(--text)]">{room.name}</h1></div>
        <form onSubmit={(event) => { event.preventDefault(); unlock() }} className="glass-panel rounded-2xl p-6">
          <Lock size={22} className="text-[var(--text-muted)]" />
          <p className="mt-3 text-sm text-[var(--text)]">This room has a password.</p>
          <label htmlFor="room-password" className="sr-only">Password</label>
          <input
            id="room-password"
            autoFocus
            type="password"
            autoComplete="off"
            value={password}
            onChange={(event) => { setPassword(event.target.value); setPasswordError('') }}
            aria-invalid={!!passwordError}
            className={`field-input mt-4 w-full rounded-xl px-4 py-2.5 text-sm ${passwordError ? 'border-[var(--danger)]' : ''}`}
          />
          {passwordError && <p role="alert" className="mt-2 text-xs text-[var(--danger)]">{passwordError}</p>}
          <button type="submit" disabled={!password} className="primary-button mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-medium">Join room</button>
        </form>
      </div>
    )
  }

  const visibleMessages = messages.filter((message) => !hiddenIds.has(message.id))

  return (
    <div className="flex h-[calc(100dvh-9rem)] gap-4 lg:h-[calc(100dvh-6.5rem)]">

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {back}
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 truncate text-lg font-semibold text-[var(--text)]">
                {room.name}
                {room.has_password && <Lock size={14} className="shrink-0 text-[var(--text-muted)]" aria-label="Password protected" />}
              </h1>
              {room.description && <p className="truncate text-xs text-[var(--text-muted)]">{room.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs ${roleStyle(myRole)}`}>{roleLabel(myRole)}{isAdmin && ', admin'}</span>
            <button onClick={copyInvite} className="secondary-button rounded-lg px-3 py-1.5 text-xs"><LinkSimple size={14} /> Invite</button>
            <button onClick={() => { setShowMembers((value) => !value); loadMembers() }} aria-expanded={showMembers} aria-label={`Members (${members.length})`} className="secondary-button rounded-lg px-3 py-1.5 text-xs">
              <UsersThree size={14} /> <span className="font-mono">{members.length}</span>
            </button>
          </div>
        </div>

        {room.pinned_message_id && room.pinned_content && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border bg-[var(--surface)] px-4 py-2">
            <PushPin size={14} weight="fill" className="shrink-0 text-[var(--accent)]" />
            <p className="flex-1 truncate text-xs text-[var(--text)]">{room.pinned_content}</p>
            {isModerator && (
              <button onClick={() => setPinned(null)} aria-label="Unpin" className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text)]"><X size={14} /></button>
            )}
          </div>
        )}

        {/* Messages */}
        <div ref={listRef} className="glass-panel mb-3 flex flex-1 flex-col gap-3 overflow-y-auto rounded-2xl p-4">
          {visibleMessages.length === 0 && <p className="mt-8 text-center text-sm text-[var(--text-muted)]">No messages yet. Say hi.</p>}
          {visibleMessages.map((message) => {
            const isMe = message.profile_id === userId
            if (message.deleted_at) {
              return (
                <div key={message.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <span className="px-4 py-1 text-xs italic text-[var(--text-muted)]">Message deleted</span>
                </div>
              )
            }

            const grouped: Record<string, { count: number; mine: boolean }> = {}
            for (const reaction of reactions) {
              if (reaction.message_id !== message.id) continue
              grouped[reaction.emoji] ??= { count: 0, mine: false }
              grouped[reaction.emoji].count++
              if (reaction.profile_id === userId) grouped[reaction.emoji].mine = true
            }
            const poll = message.poll_id ? polls[message.poll_id] : null

            const actions = (
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                {isModerator && (
                  <button onClick={() => setPinned(message)} aria-label="Pin" className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"><PushPin size={13} /></button>
                )}
                <button
                  onClick={() => setEmojiFor(emojiFor === message.id ? null : message.id)}
                  aria-label="React"
                  aria-expanded={emojiFor === message.id}
                  className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
                >
                  <Smiley size={14} />
                </button>
                <button onClick={() => setReplyTo({ id: message.id, preview: previewOf(message) })} aria-label="Reply" className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]">
                  <ArrowBendUpLeft size={14} />
                </button>
                <button onClick={() => setDeleteTarget(message)} aria-label="Delete" className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--danger)]">
                  <Trash size={14} />
                </button>
              </div>
            )

            return (
              <div key={message.id} className={`group flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                {!isMe && (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-soft)] text-xs text-[var(--text-muted)]">?</span>
                )}
                <div className={`flex max-w-[78%] flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="px-1 text-xs text-[var(--text-muted)]">{isMe ? 'You' : 'Anonymous'}</span>
                  {message.reply_preview && (
                    <div className="flex max-w-full items-center gap-1 truncate rounded-lg border-l-2 border-[var(--border-strong)] bg-[var(--surface-soft)] px-3 py-1 text-xs text-[var(--text-muted)]">
                      <ArrowBendUpLeft size={12} className="shrink-0" /> <span className="truncate">{message.reply_preview}</span>
                    </div>
                  )}
                  <div className="flex max-w-full items-center">
                    {/* Polls sit in a neutral card so their bars and percentages stay readable. */}
                    <div className={`min-w-0 rounded-2xl px-4 py-2.5 text-sm ${
                      poll || message.poll_id
                        ? 'w-[min(18rem,100%)] border bg-[var(--surface)] text-[var(--text)]'
                        : isMe ? 'rounded-br-md bg-[var(--accent)] text-[var(--on-accent)]' : 'rounded-bl-md bg-[var(--surface-soft)] text-[var(--text)]'
                    }`}>
                      {poll ? (
                        <PollCard poll={poll} votes={votes.filter((item) => item.poll_id === poll.id)} userId={userId} onVote={(index) => vote(poll.id, index)} />
                      ) : message.poll_id ? (
                        <p className="text-xs opacity-70">Loading poll…</p>
                      ) : (
                        <MessageContent message={message} fileLink={message.file_url ? fileLinks[message.file_url] : undefined} />
                      )}
                    </div>
                  </div>
                  {emojiFor === message.id && (
                    <div role="group" aria-label="Pick a reaction" className="flex gap-1 rounded-xl border bg-[var(--surface-solid)] px-2 py-1 [animation:toast-in_180ms_var(--ease-out)]">
                      {EMOJIS.map((emoji) => (
                        <button key={emoji} onClick={() => react(message.id, emoji)} className="rounded-md px-1 text-base transition-transform hover:scale-125">{emoji}</button>
                      ))}
                    </div>
                  )}
                  {Object.keys(grouped).length > 0 && (
                    <div className="mt-0.5 flex flex-wrap gap-1 px-1">
                      {Object.entries(grouped).map(([emoji, { count, mine }]) => (
                        <button
                          key={emoji}
                          onClick={() => react(message.id, emoji)}
                          aria-pressed={mine}
                          className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs ${mine ? 'border-[rgb(var(--accent-rgb)/0.4)] bg-[rgb(var(--accent-rgb)/0.12)] text-[var(--accent)]' : 'bg-[var(--surface)] hover:border-[var(--border-strong)]'}`}
                        >
                          {emoji} <span className="font-mono">{count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {/* Actions live on the timestamp line so they never squeeze the bubble. */}
                  <div className={`flex items-center gap-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <span className="whitespace-nowrap px-1 font-mono text-[11px] text-[var(--text-muted)]">
                      {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {actions}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {replyTo && (
          <div className="mb-2 flex items-center gap-2 rounded-xl border bg-[var(--surface-soft)] px-3 py-2">
            <ArrowBendUpLeft size={14} className="shrink-0 text-[var(--text-muted)]" />
            <span className="flex-1 truncate text-xs text-[var(--text-muted)]">Replying to: {replyTo.preview}</span>
            <button onClick={() => setReplyTo(null)} aria-label="Cancel reply" className="text-[var(--text-muted)] hover:text-[var(--text)]"><X size={14} /></button>
          </div>
        )}

        <form onSubmit={(event) => { event.preventDefault(); handleSend() }} className="glass-panel flex items-center gap-1.5 rounded-2xl p-1.5 focus-within:border-[var(--accent)]">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Attach a file" className="rounded-xl p-2.5 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] disabled:opacity-40">
            <Paperclip size={18} className={uploading ? 'animate-pulse' : ''} />
          </button>
          <button type="button" onClick={() => setShowPoll(true)} aria-label="Create a poll" className="rounded-xl p-2.5 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]">
            <ChartBar size={18} />
          </button>
          <input ref={fileRef} type="file" accept={FILE_TYPES.join(',')} className="hidden" onChange={handleFileUpload} />
          <label htmlFor="chat-input" className="sr-only">Message</label>
          <input
            id="chat-input"
            type="text"
            placeholder="Type a message"
            maxLength={4000}
            autoComplete="off"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            // Korean and other IMEs fire Enter to finish a character; don't send half a word.
            onKeyDown={(event) => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault() }}
            className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
          />
          <button type="submit" disabled={!input.trim() || sending} aria-label="Send" className="primary-button h-10 w-10 shrink-0 rounded-xl">
            <PaperPlaneRight size={16} weight="fill" />
          </button>
        </form>
      </div>

      {/* Members: a side column on wide screens, a sheet on phones. */}
      {showMembers && (
        <>
          <button aria-label="Close members" className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setShowMembers(false)} />
          <aside className="fixed inset-y-0 right-0 z-40 flex w-[min(18rem,100vw)] flex-col border-l bg-[var(--surface-solid)] p-4 lg:static lg:z-auto lg:w-64 lg:rounded-2xl lg:border">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-[var(--text)]">Members</h2>
              <button onClick={() => setShowMembers(false)} aria-label="Close members" className="rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--text)]"><X size={14} /></button>
            </div>
            <ul className="flex flex-1 flex-col gap-3 overflow-y-auto">
              {members.map((member) => {
                const kicked = member.kicked_until && new Date(member.kicked_until) > new Date()
                const isMe = member.profile_id === userId
                const canManage = isModerator && !isMe && member.role !== 'owner' && (isOwner || member.role === 'member')
                return (
                  <li key={member.id} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-[var(--text)]">{isMe ? 'You' : 'Anonymous'}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[11px] ${roleStyle(member.role)}`}>{roleLabel(member.role)}</span>
                    </div>
                    {kicked && (
                      <p className="text-xs text-[var(--danger)]">Kicked until {new Date(member.kicked_until!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    )}
                    {canManage && (
                      <div className="flex flex-col gap-1.5">
                        {isOwner && (
                          <select value={member.role} onChange={(event) => changeRole(member, event.target.value)} aria-label="Role" className="field-input rounded-lg px-2 py-1 text-xs">
                            <option value="member">Member</option>
                            <option value="moderator">Moderator</option>
                            <option value="owner">Make owner…</option>
                          </select>
                        )}
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={1}
                            max={1440}
                            aria-label="Kick for how many minutes"
                            value={kickMinutes[member.id] || 10}
                            onChange={(event) => setKickMinutes((previous) => ({ ...previous, [member.id]: Math.min(1440, Math.max(1, Number(event.target.value) || 1)) }))}
                            className="field-input w-16 rounded-lg px-2 py-1 text-xs"
                          />
                          <span className="text-xs text-[var(--text-muted)]">min</span>
                          <button onClick={() => kick(member)} className="ml-auto text-xs text-[var(--danger)] hover:underline">Kick</button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
            <div className="mt-3 flex flex-col gap-1 border-t pt-3">
              <button onClick={copyInvite} className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-[var(--text-muted)] hover:bg-[var(--surface-hover)]">
                <LinkSimple size={14} /> Copy invite link
              </button>
              {isOwner && (
                <button onClick={exportChat} className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-[var(--text-muted)] hover:bg-[var(--surface-hover)]">
                  <DownloadSimple size={14} /> Export chat
                </button>
              )}
              {isOwner && (
                <button onClick={() => { setDeleteRoomInput(''); setShowDeleteRoom(true) }} className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-[var(--danger)] hover:bg-[var(--danger-soft)]">
                  <Trash size={14} /> Delete room
                </button>
              )}
            </div>
          </aside>
        </>
      )}

      {deleteTarget && (
        <Modal title="Delete message?" onClose={() => setDeleteTarget(null)}>
          <p className="line-clamp-2 rounded-xl border bg-[var(--surface-soft)] px-3 py-2 text-xs text-[var(--text-muted)]">{previewOf(deleteTarget)}</p>
          <div className="mt-4 flex flex-col gap-2">
            <button onClick={() => hideForMe(deleteTarget)} className="secondary-button flex-col items-start rounded-xl px-4 py-2.5 text-left text-sm">
              Hide for me
              <span className="text-xs text-[var(--text-muted)]">Only you stop seeing it, until you reload.</span>
            </button>
            {(deleteTarget.profile_id === userId || isModerator) && (
              <button onClick={() => deleteForEveryone(deleteTarget)} className="flex flex-col items-start rounded-xl bg-[var(--danger)] px-4 py-2.5 text-left text-sm font-medium text-white hover:opacity-90">
                Delete for everyone
                <span className="text-xs font-normal opacity-85">Removes it for everyone in the room.</span>
              </button>
            )}
            <button onClick={() => setDeleteTarget(null)} className="mt-1 text-center text-xs text-[var(--text-muted)] hover:text-[var(--text)]">Cancel</button>
          </div>
        </Modal>
      )}

      {showDeleteRoom && (
        <Modal title="Delete room" description="This deletes every message in it and can't be undone. Type the room name to confirm." onClose={() => setShowDeleteRoom(false)}>
          <p className="rounded-lg border bg-[var(--surface-soft)] px-3 py-2 text-sm font-medium text-[var(--text)]">{room.name}</p>
          <label htmlFor="delete-room-name" className="sr-only">Room name</label>
          <input id="delete-room-name" autoFocus value={deleteRoomInput} onChange={(event) => setDeleteRoomInput(event.target.value)} className="field-input mt-3 w-full rounded-xl px-3 py-2 text-sm" />
          <div className="mt-4 flex gap-2">
            <button onClick={() => setShowDeleteRoom(false)} className="secondary-button flex-1 rounded-xl px-4 py-2 text-sm font-medium">Cancel</button>
            <button onClick={deleteRoom} disabled={deleteRoomInput !== room.name} className="flex-1 rounded-xl bg-[var(--danger)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40">Delete</button>
          </div>
        </Modal>
      )}

      {showPoll && (
        <Modal title="Create a poll" onClose={() => setShowPoll(false)}>
          <form onSubmit={(event) => { event.preventDefault(); sendPoll() }}>
            <label htmlFor="poll-question" className="sr-only">Question</label>
            <input id="poll-question" autoFocus maxLength={200} placeholder="Question" value={pollQuestion} onChange={(event) => setPollQuestion(event.target.value)} className="field-input w-full rounded-xl px-3 py-2 text-sm" />
            <div className="mt-3 flex flex-col gap-2">
              {pollOptions.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <label htmlFor={`poll-option-${index}`} className="sr-only">Option {index + 1}</label>
                  <input
                    id={`poll-option-${index}`}
                    maxLength={100}
                    placeholder={`Option ${index + 1}`}
                    value={option}
                    onChange={(event) => setPollOptions((previous) => previous.map((item, i) => (i === index ? event.target.value : item)))}
                    className="field-input flex-1 rounded-xl px-3 py-2 text-sm"
                  />
                  {pollOptions.length > 2 && (
                    <button type="button" onClick={() => setPollOptions((previous) => previous.filter((_, i) => i !== index))} aria-label="Remove option" className="text-[var(--text-muted)] hover:text-[var(--text)]"><X size={14} /></button>
                  )}
                </div>
              ))}
            </div>
            {pollOptions.length < 4 && (
              <button type="button" onClick={() => setPollOptions((previous) => [...previous, ''])} className="mt-2 text-xs text-[var(--text-muted)] hover:text-[var(--text)]">+ Add option</button>
            )}
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setShowPoll(false)} className="secondary-button flex-1 rounded-xl px-4 py-2 text-sm font-medium">Cancel</button>
              <button type="submit" disabled={!pollQuestion.trim() || pollOptions.filter((option) => option.trim()).length < 2} className="primary-button flex-1 rounded-xl px-4 py-2 text-sm font-medium">Send poll</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
