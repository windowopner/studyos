'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Check, Plus, X } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { pickJoined, type JoinedRelation } from '@/lib/relations'
import { dueLabel } from '@/lib/dates'
import PageHeader from '@/components/page-header'
import { toast } from '@/components/toaster'
import LoadError from '@/components/load-error'
import OrbitGlyph from '@/components/orbit-glyph'

type SubjectData = {
  name: string
  color: string
}

type AssignmentItem = {
  id: string
  title: string
  due_date: string | null
  status: string
  priority: number
  subjects: SubjectData | null
}

type RawAssignmentItem = Omit<AssignmentItem, 'subjects'> & {
  subjects: JoinedRelation<SubjectData>
}

type Todo = {
  id: string
  title: string
  done: boolean
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
        checked ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]' : 'border-[var(--border-strong)] hover:border-[var(--accent)]'
      }`}
    >
      <Check size={12} weight="bold" className={`transition-transform duration-200 ${checked ? 'scale-100' : 'scale-0'}`} />
    </button>
  )
}

function Group({ title, tone, children }: { title: string; tone?: 'danger'; children: React.ReactNode }) {
  return (
    <section>
      <h2 className={`mb-2 text-sm font-medium ${tone === 'danger' ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'}`}>{title}</h2>
      <ul className="glass-panel divide-y overflow-hidden rounded-2xl">{children}</ul>
    </section>
  )
}

export default function TodoPage() {
  const [items, setItems] = useState<AssignmentItem[]>([])
  const [todos, setTodos] = useState<Todo[]>([])
  const [newTodo, setNewTodo] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'todo' | 'done'>('todo')
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    let alive = true
    const load = async () => {
      const [{ data: assignmentData, error: assignmentError }, { data: todoData, error: todoError }] = await Promise.all([
        supabase
          .from('assignments')
          .select('id, title, due_date, status, priority, subjects(name, color)')
          .order('due_date', { ascending: true, nullsFirst: false }),
        supabase.from('todos').select('id, title, done').order('created_at', { ascending: true }),
      ])
      if (!alive) return
      setFailed(!!(assignmentError || todoError))
      setItems(((assignmentData || []) as RawAssignmentItem[]).map((item) => ({ ...item, subjects: pickJoined(item.subjects) })))
      setTodos(todoData || [])
      setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [attempt])

  const toggleAssignment = async (item: AssignmentItem) => {
    const status = item.status === 'done' ? 'todo' : 'done'
    setItems((list) => list.map((entry) => entry.id === item.id ? { ...entry, status } : entry))
    const { error } = await supabase.from('assignments').update({ status }).eq('id', item.id)
    if (error) {
      toast(error.message, 'error')
      setItems((list) => list.map((entry) => entry.id === item.id ? { ...entry, status: item.status } : entry))
    }
  }

  const addTodo = async (event: React.FormEvent) => {
    event.preventDefault()
    const title = newTodo.trim().slice(0, 300)
    if (!title || adding) return
    setAdding(true)
    setNewTodo('')
    const { data, error } = await supabase.from('todos').insert({ title }).select('id, title, done').single()
    setAdding(false)
    if (error || !data) { toast(error?.message || 'Could not add the to-do.', 'error'); setNewTodo(title); return }
    setTodos((list) => [...list, data])
  }

  const toggleTodo = async (todo: Todo) => {
    setTodos((list) => list.map((entry) => entry.id === todo.id ? { ...entry, done: !todo.done } : entry))
    const { error } = await supabase.from('todos').update({ done: !todo.done }).eq('id', todo.id)
    if (error) {
      toast(error.message, 'error')
      setTodos((list) => list.map((entry) => entry.id === todo.id ? { ...entry, done: todo.done } : entry))
    }
  }

  const deleteTodo = async (todo: Todo) => {
    setTodos((list) => list.filter((entry) => entry.id !== todo.id))
    const { error } = await supabase.from('todos').delete().eq('id', todo.id)
    if (error) { toast(error.message, 'error'); setTodos((list) => [...list, todo]) }
  }

  const clearCompleted = async () => {
    const done = todos.filter((todo) => todo.done)
    if (done.length === 0) return
    setTodos((list) => list.filter((todo) => !todo.done))
    const { error } = await supabase.from('todos').delete().in('id', done.map((todo) => todo.id))
    if (error) { toast(error.message, 'error'); setTodos((list) => [...list, ...done]) }
  }

  const openAssignments = items.filter((item) => item.status !== 'done')
  const doneAssignments = items.filter((item) => item.status === 'done')
  const openTodos = todos.filter((todo) => !todo.done)
  const doneTodos = todos.filter((todo) => todo.done)
  const total = items.length + todos.length
  const totalDone = doneAssignments.length + doneTodos.length

  const groups = [
    { key: 'overdue', title: 'Overdue', tone: 'danger' as const, list: openAssignments.filter((item) => dueLabel(item.due_date).overdue) },
    { key: 'soon', title: 'Next 3 days', list: openAssignments.filter((item) => dueLabel(item.due_date).soon) },
    { key: 'later', title: 'Later', list: openAssignments.filter((item) => item.due_date && !dueLabel(item.due_date).overdue && !dueLabel(item.due_date).soon) },
    { key: 'none', title: 'No due date', list: openAssignments.filter((item) => !item.due_date) },
  ].filter((group) => group.list.length > 0)

  const assignmentRow = (item: AssignmentItem) => {
    const due = dueLabel(item.due_date)
    const done = item.status === 'done'
    return (
      <li key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-hover)]">
        <Checkbox checked={done} onChange={() => toggleAssignment(item)} label={`Mark ${item.title} ${done ? 'not done' : 'done'}`} />
        <Link href={`/dashboard/assignments/${item.id}`} className="min-w-0 flex-1">
          <span className={`block truncate text-sm ${done ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text)]'}`}>{item.title}</span>
          {item.subjects && (
            <span className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.subjects.color }} />
              {item.subjects.name}
            </span>
          )}
        </Link>
        {!done && item.due_date && (
          <span className={`shrink-0 font-mono text-xs ${due.overdue ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'}`}>{due.text}</span>
        )}
      </li>
    )
  }

  const todoRow = (todo: Todo) => (
    <li key={todo.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-hover)]">
      <Checkbox checked={todo.done} onChange={() => toggleTodo(todo)} label={`Mark ${todo.title} ${todo.done ? 'not done' : 'done'}`} />
      <span className={`min-w-0 flex-1 truncate text-sm ${todo.done ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text)]'}`}>{todo.title}</span>
      <button
        onClick={() => deleteTodo(todo)}
        aria-label={`Delete ${todo.title}`}
        className="rounded-md p-1 text-[var(--text-muted)] opacity-0 hover:text-[var(--danger)] focus-visible:opacity-100 group-hover:opacity-100"
      >
        <X size={14} />
      </button>
    </li>
  )

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="To-do"
        description="Your assignments by due date, plus anything else you need to remember."
        actions={!loading && total > 0 ? (
          <span className="font-mono text-sm text-[var(--text-muted)]">{totalDone} of {total} done</span>
        ) : undefined}
      />

      <form onSubmit={addTodo} className="glass-panel mb-6 flex items-center gap-2 rounded-2xl p-2 pl-4 focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_3px_rgb(var(--accent-rgb)/0.14)]">
        <Plus size={16} className="shrink-0 text-[var(--text-muted)]" />
        <label htmlFor="new-todo" className="sr-only">New to-do</label>
        <input
          id="new-todo"
          value={newTodo}
          onChange={(event) => setNewTodo(event.target.value)}
          placeholder="Add a to-do, e.g. Return library book"
          maxLength={300}
          className="min-w-0 flex-1 bg-transparent py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
        />
        <button type="submit" disabled={!newTodo.trim() || adding} className="primary-button rounded-xl px-4 py-2 text-sm font-medium">Add</button>
      </form>

      <div role="tablist" aria-label="Show" className="mb-6 inline-flex rounded-xl border bg-[var(--surface)] p-1">
        {(['todo', 'done'] as const).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-lg px-3 py-1.5 text-sm ${tab === key ? 'bg-[var(--surface-soft)] font-medium text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
          >
            {key === 'todo' ? 'To do' : 'Done'}
            <span className="ml-1.5 font-mono text-xs text-[var(--text-muted)]">
              {key === 'todo' ? openAssignments.length + openTodos.length : totalDone}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((row) => <div key={row} className="skeleton h-12 rounded-xl" />)}</div>
      ) : failed ? (
        <LoadError message="Your list couldn’t load. Check your connection and try again." onRetry={() => { setLoading(true); setAttempt((value) => value + 1) }} />
      ) : tab === 'todo' ? (
        openAssignments.length + openTodos.length === 0 ? (
          <div className="empty-card rounded-2xl px-6 py-14 text-center">
          <OrbitGlyph />
            <p className="text-sm font-medium text-[var(--text)]">All clear</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Nothing left to do. Add something above if you think of it.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {openTodos.length > 0 && <Group title="Your to-dos">{openTodos.map(todoRow)}</Group>}
            {groups.map((group) => (
              <Group key={group.key} title={group.title} tone={group.tone}>{group.list.map(assignmentRow)}</Group>
            ))}
          </div>
        )
      ) : totalDone === 0 ? (
        <div className="empty-card rounded-2xl px-6 py-14 text-center">
          <OrbitGlyph />
          <p className="text-sm text-[var(--text-muted)]">Finished items will show up here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {doneTodos.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-medium text-[var(--text-muted)]">Your to-dos</h2>
                <button onClick={clearCompleted} className="text-xs text-[var(--text-muted)] hover:text-[var(--danger)]">Clear finished</button>
              </div>
              <ul className="glass-panel divide-y overflow-hidden rounded-2xl">{doneTodos.map(todoRow)}</ul>
            </section>
          )}
          {doneAssignments.length > 0 && <Group title="Assignments">{doneAssignments.map(assignmentRow)}</Group>}
        </div>
      )}
    </div>
  )
}
