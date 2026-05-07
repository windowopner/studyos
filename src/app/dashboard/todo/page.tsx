'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { pickJoined, type JoinedRelation } from '@/lib/relations'
import { spotlightProps } from '@/lib/spotlight'

type SubjectData = {
  name: string
  color: string
}

type SubjectBadge = SubjectData | null

type TodoItem = {
  id: string
  title: string
  due_date: string | null
  status: string
  priority: number
  subjects: SubjectBadge
}

type RawTodoItem = Omit<TodoItem, 'subjects'> & {
  subjects: JoinedRelation<SubjectData>
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

    setItems(((data || []) as RawTodoItem[]).map((item) => ({
      ...item,
      subjects: pickJoined(item.subjects),
    })))
    setLoading(false)
  }

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('assignments')
        .select('id, title, due_date, status, priority, subjects(name, color)')
        .order('due_date', { ascending: true })

      setItems(((data || []) as RawTodoItem[]).map((item) => ({
        ...item,
        subjects: pickJoined(item.subjects),
      })))
      setLoading(false)
    }

    load()
  }, [])

  const toggleAssignment = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done'
    await supabase.from('assignments').update({ status: newStatus }).eq('id', id)
    setItems((previous) => previous.map((item) => item.id === id ? { ...item, status: newStatus } : item))
  }

  const addCustomTodo = () => {
    if (!newTodo.trim()) return
    setCustomTodos((previous) => [
      ...previous,
      { id: crypto.randomUUID(), title: newTodo.trim(), done: false },
    ])
    setNewTodo('')
  }

  const toggleCustomTodo = (id: string) => {
    setCustomTodos((previous) => previous.map((todo) => todo.id === id ? { ...todo, done: !todo.done } : todo))
  }

  const deleteCustomTodo = (id: string) => {
    setCustomTodos((previous) => previous.filter((todo) => todo.id !== id))
  }

  const handleClearAll = async () => {
    if (!confirm('Clear everything? This cannot be undone.')) return
    setClearing(true)
    const ids = items.map((assignment) => assignment.id)
    if (ids.length > 0) await supabase.from('assignments').delete().in('id', ids)
    setCustomTodos([])
    await fetchItems()
    setClearing(false)
  }

  const today = new Date().toISOString().split('T')[0]
  const todoAssignments = items.filter((item) => item.status !== 'done')
  const doneAssignments = items.filter((item) => item.status === 'done')
  const todoCustom = customTodos.filter((todo) => !todo.done)
  const doneCustom = customTodos.filter((todo) => todo.done)
  const totalAll = items.length + customTodos.length
  const totalDone = doneAssignments.length + doneCustom.length
  const progress = totalAll === 0 ? 0 : Math.round((totalDone / totalAll) * 100)
  const overdueItems = todoAssignments.filter((item) => item.due_date && item.due_date < today)
  const todayItems = todoAssignments.filter((item) => item.due_date === today)
  const upcomingItems = todoAssignments.filter((item) => item.due_date && item.due_date > today)
  const nodateItems = todoAssignments.filter((item) => !item.due_date)

  if (loading) {
    return <div className="text-sm text-[var(--text-muted)]">Loading...</div>
  }

  return (
    <div className="mx-auto max-w-5xl">
      <section className="glass-panel rounded-[32px] px-6 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <p className="page-kicker">To-do</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text)]">Keep momentum visible</h1>
            <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
              Tasks now sit in a calmer board with stronger progress feedback and more tactile interactions.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:w-[34rem]">
            {[
              { label: 'Progress', value: `${progress}%`, detail: `${totalDone} of ${totalAll} complete` },
              { label: 'Active items', value: `${todoAssignments.length + todoCustom.length}`, detail: 'Still on your plate' },
              { label: 'Done', value: `${doneAssignments.length + doneCustom.length}`, detail: 'Already handled' },
            ].map((stat) => (
              <div key={stat.label} className="interactive-card rounded-[28px] px-4 py-4" {...spotlightProps}>
                <p className="relative z-10 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">{stat.label}</p>
                <p className="relative z-10 mt-3 text-2xl font-semibold text-[var(--text)]">{stat.value}</p>
                <p className="relative z-10 mt-2 text-sm text-[var(--text-muted)]">{stat.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-[var(--text-muted)]">Overall progress</span>
            <span className="text-sm font-semibold text-[var(--text)]">{progress}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white/6">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ background: 'linear-gradient(135deg, rgb(var(--accent-rgb)), rgb(var(--accent-secondary-rgb)))', width: `${progress}%` }}
            />
          </div>
        </div>
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="glass-panel flex rounded-full p-1">
          <button
            onClick={() => setTab('todo')}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              tab === 'todo' ? 'bg-[rgb(var(--accent-rgb)_/_0.16)] text-[var(--text)]' : 'text-[var(--text-muted)]'
            }`}
          >
            To-do ({todoAssignments.length + todoCustom.length})
          </button>
          <button
            onClick={() => setTab('done')}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              tab === 'done' ? 'bg-[rgb(var(--accent-rgb)_/_0.16)] text-[var(--text)]' : 'text-[var(--text-muted)]'
            }`}
          >
            Done ({doneAssignments.length + doneCustom.length})
          </button>
        </div>

        {totalAll > 0 && (
          <button
            onClick={handleClearAll}
            disabled={clearing}
            className="ghost-button text-sm font-medium text-red-400 hover:text-red-300 disabled:opacity-40"
          >
            {clearing ? 'Clearing...' : 'Clear all'}
          </button>
        )}
      </div>

      {tab === 'todo' && (
        <>
          <section className="glass-panel mt-6 rounded-[28px] px-5 py-5 sm:px-6">
            <p className="section-label">Quick add</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                placeholder="Add a quick to-do..."
                value={newTodo}
                onChange={(event) => setNewTodo(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && addCustomTodo()}
                className="field-input w-full rounded-2xl px-4 py-3 text-sm"
              />
              <button
                onClick={addCustomTodo}
                className="primary-button rounded-2xl px-5 py-3 text-sm font-semibold sm:w-auto"
              >
                Add task
              </button>
            </div>
          </section>

          {todoCustom.length > 0 && (
            <Section label="Quick tasks">
              {todoCustom.map((todo) => (
                <div
                  key={todo.id}
                  className="interactive-card flex items-center gap-3 rounded-[24px] px-4 py-4"
                  {...spotlightProps}
                >
                  <input
                    type="checkbox"
                    checked={todo.done}
                    onChange={() => toggleCustomTodo(todo.id)}
                    className="relative z-10"
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <span className="relative z-10 flex-1 text-sm text-[var(--text)]">{todo.title}</span>
                  <button
                    onClick={() => deleteCustomTodo(todo.id)}
                    className="relative z-10 text-xs text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </Section>
          )}

          {overdueItems.length > 0 && (
            <Section label="Overdue" labelClass="text-red-400">
              {overdueItems.map((item) => (
                <AssignmentRow key={item.id} item={item} onToggle={toggleAssignment} today={today} />
              ))}
            </Section>
          )}

          {todayItems.length > 0 && (
            <Section label="Due today">
              {todayItems.map((item) => (
                <AssignmentRow key={item.id} item={item} onToggle={toggleAssignment} today={today} />
              ))}
            </Section>
          )}

          {upcomingItems.length > 0 && (
            <Section label="Upcoming">
              {upcomingItems.map((item) => (
                <AssignmentRow key={item.id} item={item} onToggle={toggleAssignment} today={today} />
              ))}
            </Section>
          )}

          {nodateItems.length > 0 && (
            <Section label="No due date">
              {nodateItems.map((item) => (
                <AssignmentRow key={item.id} item={item} onToggle={toggleAssignment} today={today} />
              ))}
            </Section>
          )}

          {todoAssignments.length === 0 && todoCustom.length === 0 && (
            <div className="empty-card mt-6 rounded-[28px] px-6 py-12 text-center">
              <p className="text-sm text-[var(--text-muted)]">All done. 🎉</p>
            </div>
          )}
        </>
      )}

      {tab === 'done' && (
        <section className="mt-6 space-y-3">
          {doneCustom.map((todo) => (
            <div
              key={todo.id}
              className="interactive-card flex items-center gap-3 rounded-[24px] px-4 py-4"
              {...spotlightProps}
            >
              <input
                type="checkbox"
                checked={todo.done}
                onChange={() => toggleCustomTodo(todo.id)}
                className="relative z-10"
                style={{ accentColor: 'var(--accent)' }}
              />
              <span className="relative z-10 flex-1 text-sm text-[var(--text-muted)] line-through">{todo.title}</span>
              <button
                onClick={() => deleteCustomTodo(todo.id)}
                className="relative z-10 text-xs text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            </div>
          ))}

          {doneAssignments.map((item) => (
            <AssignmentRow key={item.id} item={item} onToggle={toggleAssignment} today={today} />
          ))}

          {doneAssignments.length === 0 && doneCustom.length === 0 && (
            <div className="empty-card rounded-[28px] px-6 py-12 text-center">
              <p className="text-sm text-[var(--text-muted)]">Nothing completed yet.</p>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function Section({
  label,
  labelClass,
  children,
}: {
  label: string
  labelClass?: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-6">
      <p className={`section-label ${labelClass ?? ''}`}>{label}</p>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  )
}

function AssignmentRow({
  item,
  onToggle,
  today,
}: {
  item: TodoItem
  onToggle: (id: string, status: string) => void
  today: string
}) {
  const isOverdue = item.due_date && item.due_date < today && item.status !== 'done'

  return (
    <div className="interactive-card flex items-center gap-3 rounded-[24px] px-4 py-4" {...spotlightProps}>
      <input
        type="checkbox"
        checked={item.status === 'done'}
        onChange={() => onToggle(item.id, item.status)}
        className="relative z-10"
        style={{ accentColor: 'var(--accent)' }}
      />

      <div
        className={`relative z-10 h-2.5 w-2.5 rounded-full ${
          item.priority === 3 ? 'bg-red-400' : item.priority === 2 ? 'bg-amber-300' : 'bg-slate-400'
        }`}
      />

      <div className="relative z-10 min-w-0 flex-1">
        <p
          className={`text-sm ${item.status === 'done' ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text)]'}`}
        >
          {item.title}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {item.subjects && (
            <span
              className="rounded-full px-2 py-1 text-[11px] font-medium text-white"
              style={{ backgroundColor: item.subjects.color }}
            >
              {item.subjects.name}
            </span>
          )}

          {item.due_date && (
            <span className={`text-[11px] ${isOverdue ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>
              {isOverdue ? 'Overdue · ' : ''}
              {new Date(item.due_date).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
