'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type TodoItem = {
  id: string
  title: string
  due_date: string | null
  status: string
  priority: number
  subjects: any
}

type CustomTodo = {
  id: string
  title: string
  done: boolean
}

export default function TodoPage() {
  const [items, setItems] = useState<TodoItem[]>([])
  const [customTodos, setCustomTodos] = useState<CustomTodo[]>([])
  const [newTodo, setNewTodo] = useState('')
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [tab, setTab] = useState<'todo' | 'done'>('todo')

  const fetchItems = async () => {
    const { data } = await supabase
      .from('assignments')
      .select('id, title, due_date, status, priority, subjects(name, color)')
      .order('due_date', { ascending: true })
    setItems((data || []) as any)
    setLoading(false)
  }

  useEffect(() => { fetchItems() }, [])

  const toggleAssignment = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done'
    await supabase.from('assignments').update({ status: newStatus }).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i))
  }

  const addCustomTodo = () => {
    if (!newTodo.trim()) return
    setCustomTodos(prev => [...prev, { id: crypto.randomUUID(), title: newTodo.trim(), done: false }])
    setNewTodo('')
  }

  const toggleCustomTodo = (id: string) => {
    setCustomTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))
  }

  const deleteCustomTodo = (id: string) => {
    setCustomTodos(prev => prev.filter(t => t.id !== id))
  }

  const handleClearAll = async () => {
    if (!confirm('Clear everything? This cannot be undone.')) return
    setClearing(true)
    const ids = items.map(a => a.id)
    if (ids.length > 0) await supabase.from('assignments').delete().in('id', ids)
    setCustomTodos([])
    await fetchItems()
    setClearing(false)
  }

  const today = new Date().toISOString().split('T')[0]

  const todoAssignments = items.filter(i => i.status !== 'done')
  const doneAssignments = items.filter(i => i.status === 'done')
  const todoCustom = customTodos.filter(t => !t.done)
  const doneCustom = customTodos.filter(t => t.done)

  const totalAll = items.length + customTodos.length
  const totalDone = doneAssignments.length + doneCustom.length
  const progress = totalAll === 0 ? 0 : Math.round((totalDone / totalAll) * 100)

  const overdueItems = todoAssignments.filter(i => i.due_date && i.due_date < today)
  const todayItems = todoAssignments.filter(i => i.due_date === today)
  const upcomingItems = todoAssignments.filter(i => i.due_date && i.due_date > today)
  const nodateItems = todoAssignments.filter(i => !i.due_date)

  if (loading) return <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</div>

  return (
    <div className="max-w-2xl mx-auto">

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>To-do</h1>
        {totalAll > 0 && (
          <button
            onClick={handleClearAll}
            disabled={clearing}
            className="text-xs text-red-400 hover:text-red-300 transition disabled:opacity-40"
          >
            {clearing ? 'Clearing...' : 'Clear all'}
          </button>
        )}
      </div>

      {/* 진행률 바 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Overall progress</span>
          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{progress}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
          <div
            className="h-full rounded-full transition-all duration-500 bg-[#4ECDC4]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>{totalDone} of {totalAll} completed</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={() => setTab('todo')}
          className={`px-4 py-2 text-sm transition ${
            tab === 'todo'
              ? 'border-b-2 border-[#4ECDC4] text-[#4ECDC4] font-medium'
              : 'hover:text-[color:var(--text)]'
          }`}
          style={{ color: tab === 'todo' ? undefined : 'var(--text-muted)' }}
        >
          To-do ({todoAssignments.length + todoCustom.length})
        </button>
        <button
          onClick={() => setTab('done')}
          className={`px-4 py-2 text-sm transition ${
            tab === 'done'
              ? 'border-b-2 border-[#4ECDC4] text-[#4ECDC4] font-medium'
              : 'hover:text-[color:var(--text)]'
          }`}
          style={{ color: tab === 'done' ? undefined : 'var(--text-muted)' }}
        >
          Done ({doneAssignments.length + doneCustom.length})
        </button>
      </div>

      {tab === 'todo' && (
        <>
          {/* 빠른 할 일 입력 */}
          <div className="flex gap-2 mb-8">
            <input
              type="text"
              placeholder="Add a quick to-do..."
              value={newTodo}
              onChange={e => setNewTodo(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustomTodo()}
              className="flex-1 rounded-xl px-4 py-2.5 text-sm outline-none border focus:border-[#4ECDC4] transition"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
            <button
              onClick={addCustomTodo}
              className="px-4 py-2.5 text-sm rounded-xl font-medium transition bg-[#4ECDC4] text-[#1c1d22] hover:bg-[#3dbdb5]"
            >
              Add
            </button>
          </div>

          {/* 커스텀 할 일 */}
          {todoCustom.length > 0 && (
            <Section label="Quick tasks">
              {todoCustom.map(t => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 p-3 border rounded-xl group transition hover:border-[#4ECDC4]/40"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                >
                  <input type="checkbox" checked={t.done} onChange={() => toggleCustomTodo(t.id)} className="accent-[#4ECDC4] rounded" />
                  <span className="text-sm flex-1" style={{ color: 'var(--text)' }}>{t.title}</span>
                  <button
                    onClick={() => deleteCustomTodo(t.id)}
                    className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-300 transition"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </Section>
          )}

          {overdueItems.length > 0 && (
            <Section label="Overdue" labelClass="text-red-400">
              {overdueItems.map(i => <AssignmentRow key={i.id} item={i} onToggle={toggleAssignment} today={today} />)}
            </Section>
          )}
          {todayItems.length > 0 && (
            <Section label="Due today">
              {todayItems.map(i => <AssignmentRow key={i.id} item={i} onToggle={toggleAssignment} today={today} />)}
            </Section>
          )}
          {upcomingItems.length > 0 && (
            <Section label="Upcoming">
              {upcomingItems.map(i => <AssignmentRow key={i.id} item={i} onToggle={toggleAssignment} today={today} />)}
            </Section>
          )}
          {nodateItems.length > 0 && (
            <Section label="No due date">
              {nodateItems.map(i => <AssignmentRow key={i.id} item={i} onToggle={toggleAssignment} today={today} />)}
            </Section>
          )}

          {todoAssignments.length === 0 && todoCustom.length === 0 && (
            <p className="text-sm text-center mt-12" style={{ color: 'var(--text-muted)' }}>All done. 🎉</p>
          )}
        </>
      )}

      {tab === 'done' && (
        <div className="flex flex-col gap-2">
          {doneCustom.map(t => (
            <div
              key={t.id}
              className="flex items-center gap-3 p-3 border rounded-xl group transition"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <input type="checkbox" checked={t.done} onChange={() => toggleCustomTodo(t.id)} className="accent-[#4ECDC4] rounded" />
              <span className="text-sm flex-1 line-through" style={{ color: 'var(--text-muted)' }}>{t.title}</span>
              <button
                onClick={() => deleteCustomTodo(t.id)}
                className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-300 transition"
              >
                Remove
              </button>
            </div>
          ))}
          {doneAssignments.map(i => <AssignmentRow key={i.id} item={i} onToggle={toggleAssignment} today={today} />)}
          {doneAssignments.length === 0 && doneCustom.length === 0 && (
            <p className="text-sm text-center mt-12" style={{ color: 'var(--text-muted)' }}>Nothing completed yet.</p>
          )}
        </div>
      )}
    </div>
  )
}

function Section({ label, labelClass, children }: { label: string; labelClass?: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className={`text-xs uppercase tracking-wider mb-2 ${labelClass ?? ''}`}
        style={labelClass ? undefined : { color: 'var(--text-muted)' }}>
        {label}
      </p>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

function AssignmentRow({
  item, onToggle, today,
}: {
  item: TodoItem
  onToggle: (id: string, status: string) => void
  today: string
}) {
  const isOverdue = item.due_date && item.due_date < today && item.status !== 'done'

  return (
    <div
      className="flex items-center gap-3 p-3 border rounded-xl transition hover:border-[#4ECDC4]/40"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <input
        type="checkbox"
        checked={item.status === 'done'}
        onChange={() => onToggle(item.id, item.status)}
        className="accent-[#4ECDC4] rounded flex-shrink-0"
      />
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
        item.priority === 3 ? 'bg-red-500' : item.priority === 2 ? 'bg-yellow-400' : 'bg-gray-500'
      }`} />
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm ${item.status === 'done' ? 'line-through' : ''}`}
          style={{ color: item.status === 'done' ? 'var(--text-muted)' : 'var(--text)' }}
        >
          {item.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {item.subjects && (
            <span className="text-xs px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: item.subjects.color }}>
              {item.subjects.name}
            </span>
          )}
          {item.due_date && (
            <span className={`text-xs ${isOverdue ? 'text-red-400' : ''}`}
              style={isOverdue ? undefined : { color: 'var(--text-muted)' }}>
              {isOverdue ? 'Overdue · ' : ''}{new Date(item.due_date).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
