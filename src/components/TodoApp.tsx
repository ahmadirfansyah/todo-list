import { useEffect, useState, useCallback, type FormEvent, type KeyboardEvent } from 'react';
import {
  Plus,
  Check,
  Pencil,
  Trash2,
  Circle,
  CheckCircle2,
  Loader2,
  X,
  ListTodo,
} from 'lucide-react';
import { supabase, type Todo } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

type Filter = 'all' | 'active' | 'completed';
type LoadState = 'loading' | 'loaded' | 'error';

const FILTER_KEY = 'tasked:filter';
const MAX_TITLE = 200;

export default function TodoApp() {
  const { user, signOut } = useAuth();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [filter, setFilter] = useState<Filter>(() => (localStorage.getItem(FILTER_KEY) as Filter) || 'all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchTodos = useCallback(async () => {
    setLoadState('loading');
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .order('completed', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      setLoadState('error');
      return;
    }
    setTodos(data as Todo[]);
    setLoadState('loaded');
  }, []);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  useEffect(() => {
    localStorage.setItem(FILTER_KEY, filter);
  }, [filter]);

  const showError = (msg: string) => {
    setActionError(msg);
    window.setTimeout(() => setActionError(null), 4000);
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_TITLE) {
      showError(`Title must be ${MAX_TITLE} characters or fewer.`);
      return;
    }

    setAdding(true);
    const { data, error } = await supabase
      .from('todos')
      .insert({ title: trimmed })
      .select()
      .single();

    setAdding(false);

    if (error || !data) {
      showError('Failed to add todo. Please try again.');
      return;
    }
    setTodos((prev) => [data as Todo, ...prev]);
    setNewTitle('');
  };

  const toggleComplete = async (todo: Todo) => {
    const next = !todo.completed;
    // optimistic update
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, completed: next } : t)));

    const { error } = await supabase
      .from('todos')
      .update({ completed: next })
      .eq('id', todo.id);

    if (error) {
      // rollback
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, completed: todo.completed } : t)));
      showError('Failed to update todo. Please try again.');
      return;
    }
    // re-sort: incomplete first, newest first
    setTodos((prev) =>
      [...prev].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return b.created_at.localeCompare(a.created_at);
      })
    );
  };

  const startEdit = (todo: Todo) => {
    setEditingId(todo.id);
    setEditTitle(todo.title);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const saveEdit = async (todo: Todo) => {
    const trimmed = editTitle.trim();
    if (!trimmed) {
      cancelEdit();
      return;
    }
    if (trimmed === todo.title) {
      cancelEdit();
      return;
    }
    if (trimmed.length > MAX_TITLE) {
      showError(`Title must be ${MAX_TITLE} characters or fewer.`);
      return;
    }

    const prevTitle = todo.title;
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, title: trimmed } : t)));
    setEditingId(null);
    setEditTitle('');

    const { error } = await supabase
      .from('todos')
      .update({ title: trimmed })
      .eq('id', todo.id);

    if (error) {
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, title: prevTitle } : t)));
      showError('Failed to save edit. Please try again.');
    }
  };

  const handleEditKeyDown = (e: KeyboardEvent<HTMLInputElement>, todo: Todo) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit(todo);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  const handleDelete = async (todo: Todo) => {
    setConfirmDeleteId(null);
    const prevTodos = todos;
    setTodos((prev) => prev.filter((t) => t.id !== todo.id));

    const { error } = await supabase.from('todos').delete().eq('id', todo.id);

    if (error) {
      setTodos(prevTodos);
      showError('Failed to delete todo. Please try again.');
    }
  };

  const filtered = todos.filter((t) => {
    if (filter === 'active') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  const activeCount = todos.filter((t) => !t.completed).length;
  const completedCount = todos.length - activeCount;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/40">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-md bg-white/80 border-b border-slate-100">
        <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/20">
              <CheckCircle2 className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">MyTugasGua</h1>
              <p className="text-xs text-slate-500 leading-tight">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="text-sm font-medium text-slate-500 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Add form */}
        <form onSubmit={handleAdd} className="flex gap-2 mb-5">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add a new todo..."
            maxLength={MAX_TITLE}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 shadow-sm transition"
          />
          <button
            type="submit"
            disabled={adding || !newTitle.trim()}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span className="hidden sm:inline">Add</span>
          </button>
        </form>

        {/* Filter tabs */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
            {(['all', 'active', 'completed'] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${
                  filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-400">
            {activeCount} active · {completedCount} done
          </span>
        </div>

        {/* Action error toast */}
        {actionError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
            {actionError}
          </div>
        )}

        {/* List states */}
        {loadState === 'loading' && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-slate-100 shadow-sm">
                <div className="w-5 h-5 rounded-full bg-slate-100 animate-pulse" />
                <div className="flex-1 h-4 rounded bg-slate-100 animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {loadState === 'error' && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
              <X className="w-6 h-6 text-red-500" />
            </div>
            <p className="text-sm font-medium text-slate-700">Failed to load todos</p>
            <button
              onClick={fetchTodos}
              className="mt-3 text-sm font-medium text-emerald-600 hover:text-emerald-700"
            >
              Try again
            </button>
          </div>
        )}

        {loadState === 'loaded' && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <ListTodo className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-700">
              {todos.length === 0 ? 'No todos yet' : `No ${filter} todos`}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {todos.length === 0 ? 'Add your first todo above to get started.' : 'Try a different filter.'}
            </p>
          </div>
        )}

        {loadState === 'loaded' && filtered.length > 0 && (
          <ul className="space-y-2">
            {filtered.map((todo) => (
              <li
                key={todo.id}
                className="group flex items-center gap-3 p-3.5 rounded-xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200 transition-all"
              >
                {/* Toggle / checkbox */}
                <button
                  onClick={() => toggleComplete(todo)}
                  aria-label={todo.completed ? 'Mark as incomplete' : 'Mark as complete'}
                  className="shrink-0 transition-transform hover:scale-110 active:scale-95"
                >
                  {todo.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" strokeWidth={2.5} />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-300 hover:text-emerald-400" strokeWidth={2.5} />
                  )}
                </button>

                {/* Title or edit input */}
                {editingId === todo.id ? (
                  <input
                    autoFocus
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => handleEditKeyDown(e, todo)}
                    maxLength={MAX_TITLE}
                    className="flex-1 px-2 py-1 -mx-2 rounded-md border border-emerald-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                ) : (
                  <span
                    className={`flex-1 text-sm transition-colors ${
                      todo.completed ? 'text-slate-400 line-through' : 'text-slate-800'
                    }`}
                  >
                    {todo.title}
                  </span>
                )}

                {/* Actions */}
                {editingId === todo.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => saveEdit(todo)}
                      aria-label="Save edit"
                      className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={cancelEdit}
                      aria-label="Cancel edit"
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : confirmDeleteId === todo.id ? (
                  <div className="flex items-center gap-1.5 text-xs">
                    <button
                      onClick={() => handleDelete(todo)}
                      className="px-2 py-1 rounded-md bg-red-500 text-white font-medium hover:bg-red-600 transition"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2 py-1 rounded-md text-slate-500 font-medium hover:bg-slate-100 transition"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(todo)}
                      aria-label="Edit todo"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(todo.id)}
                      aria-label="Delete todo"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
