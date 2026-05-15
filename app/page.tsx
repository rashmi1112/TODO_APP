"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

const DOMAIN = "@things-todo.app";
function usernameFromEmail(email: string) {
  return email.replace(DOMAIN, "");
}

const QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "Do something today that your future self will thank you for.", author: "Sean Patrick Flanery" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Small daily improvements over time lead to stunning results.", author: "Robin Sharma" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "You are capable of more than you know.", author: "E. O. Wilson" },
  { text: "Done is better than perfect.", author: "Sheryl Sandberg" },
  { text: "Push yourself, because no one else is going to do it for you.", author: "Unknown" },
  { text: "Great things are done by a series of small things brought together.", author: "Vincent Van Gogh" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
];

interface Todo {
  id: number;
  text: string;
  completed: boolean;
  createdAt: Date;
  listName: string;
}

interface TodoRow {
  id: number;
  text: string;
  completed: boolean;
  created_at: string;
  list_name: string;
}

function rowToTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    text: row.text,
    completed: row.completed,
    createdAt: new Date(row.created_at),
    listName: row.list_name,
  };
}

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

const DEFAULT_LIST = "default";
const MAX_UNDO = 10;

export default function Home() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState("");
  const [undoStack, setUndoStack] = useState<Todo[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<{ text: string; author: string } | null>(null);

  // List management
  const [lists, setLists] = useState<string[]>([]);
  const [activeList, setActiveList] = useState("");
  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState("");

  useEffect(() => {
    setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  }, []);

  // ---------- auth ----------

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
      if (!session) router.push("/auth");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) router.push("/auth");
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // ---------- load from Supabase on mount ----------

  useEffect(() => {
    if (!session) return;
    const fetchTodos = async () => {
      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .order("created_at", { ascending: true });

      if (!error && data) {
        const mapped = (data as TodoRow[]).map(rowToTodo);
        setTodos(mapped);
        const names = Array.from(new Set(mapped.map((t) => t.listName)));
        setLists(names);
        if (names.length > 0) setActiveList(names[0]);
      }
      setLoading(false);
    };
    fetchTodos();
  }, [session]);

  // ---------- list actions ----------

  const createList = () => {
    const name = newListName.trim();
    if (!name || lists.includes(name)) return;
    setLists((prev) => [...prev, name]);
    setActiveList(name);
    setNewListName("");
    setShowNewList(false);
  };

  // ---------- helpers ----------

  const pushUndo = (task: Todo) => {
    setUndoStack((prev) => [task, ...prev].slice(0, MAX_UNDO));
  };

  // ---------- todo actions ----------

  const addTodo = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput("");

    const { data, error } = await supabase
      .from("todos")
      .insert({ text: trimmed, completed: false, list_name: activeList, user_id: session?.user.id })
      .select()
      .single();

    if (!error && data) setTodos((prev) => [...prev, rowToTodo(data as TodoRow)]);
  };

  const toggleTodo = async (id: number) => {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    const newVal = !todo.completed;
    const { error } = await supabase.from("todos").update({ completed: newVal }).eq("id", id);
    if (!error) setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, completed: newVal } : t)));
  };

  const deleteTodo = async (id: number) => {
    const task = todos.find((t) => t.id === id);
    const { error } = await supabase.from("todos").delete().eq("id", id);
    if (!error) {
      if (task) pushUndo(task);
      setTodos((prev) => prev.filter((t) => t.id !== id));
    }
  };

  const clearCompleted = async () => {
    const completed = activeTodos.filter((t) => t.completed);
    const ids = completed.map((t) => t.id);
    const { error } = await supabase.from("todos").delete().in("id", ids);
    if (!error) {
      completed.forEach((t) => pushUndo(t));
      setTodos((prev) => prev.filter((t) => !completed.find((c) => c.id === t.id)));
    }
  };

  const clearAllTasks = async () => {
    const ids = activeTodos.map((t) => t.id);
    if (!ids.length) return;
    const { error } = await supabase.from("todos").delete().in("id", ids);
    if (!error) {
      activeTodos.forEach((t) => pushUndo(t));
      setTodos((prev) => prev.filter((t) => t.listName !== activeList));
    }
  };

  const deleteList = async (listName: string) => {
    const ids = todos.filter((t) => t.listName === listName).map((t) => t.id);
    if (ids.length) await supabase.from("todos").delete().in("id", ids);
    setLists((prev) => {
      const remaining = prev.filter((l) => l !== listName);
      if (activeList === listName) setActiveList(remaining[0] ?? "");
      return remaining;
    });
    setTodos((prev) => prev.filter((t) => t.listName !== listName));
  };

  const undo = async () => {
    if (!undoStack.length) return;
    const [latest, ...rest] = undoStack;
    const { data, error } = await supabase
      .from("todos")
      .insert({ text: latest.text, completed: false, created_at: latest.createdAt.toISOString(), list_name: latest.listName, user_id: session?.user.id })
      .select()
      .single();
    if (!error && data) {
      setTodos((prev) => [...prev, rowToTodo(data as TodoRow)]);
      setUndoStack(rest);
    }
  };

  const restoreTask = async (task: Todo) => {
    const { data, error } = await supabase
      .from("todos")
      .insert({ text: task.text, completed: false, created_at: task.createdAt.toISOString(), list_name: task.listName, user_id: session?.user.id })
      .select()
      .single();
    if (!error && data) {
      setUndoStack((prev) => prev.filter((t) => t.id !== task.id));
      setTodos((prev) => [...prev, rowToTodo(data as TodoRow)]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") addTodo();
  };

  const handleNewListKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") createList();
    if (e.key === "Escape") { setShowNewList(false); setNewListName(""); }
  };

  // ---------- derived ----------

  const activeTodos = todos.filter((t) => t.listName === activeList);
  const remaining = activeTodos.filter((t) => !t.completed).length;
  const hasCompleted = activeTodos.some((t) => t.completed);
  const canUndo = undoStack.length > 0;

  const removedTodayIds = new Set(undoStack.filter((t) => isToday(t.createdAt)).map((t) => t.id));
  const activeTodayIds = new Set(activeTodos.filter((t) => isToday(t.createdAt)).map((t) => t.id));
  const allTodayTasks = [
    ...activeTodos.filter((t) => isToday(t.createdAt)),
    ...undoStack.filter((t) => isToday(t.createdAt) && t.listName === activeList && !activeTodayIds.has(t.id)),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const displayName = (name: string) => name === DEFAULT_LIST ? "My List" : name;

  // ---------- render ----------

  if (authLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center">
        <p className="text-indigo-400 text-sm animate-pulse">Loading…</p>
      </main>
    );
  }

  if (!session) return null;

  const username = usernameFromEmail(session.user.email ?? "");

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex flex-col items-center justify-center p-4 gap-6">

      {/* Motivational quote */}
      {quote && (
        <div className="w-full max-w-2xl text-center px-2">
          <p className="text-base text-indigo-500 italic">"{quote.text}"</p>
          <p className="text-xs text-indigo-300 mt-1">— {quote.author}</p>
        </div>
      )}

      {/* Main card — wider */}
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-8 relative">

        {/* Header row */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-3xl font-bold text-indigo-600">Things To-do</h1>
            <p className="text-xs text-gray-400 mt-0.5">Hey, <span className="font-medium text-indigo-400">{username}</span> 👋</p>
          </div>
          <div className="flex items-center gap-2">
            {/* New List button */}
            <button
              onClick={() => setShowNewList(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New List
            </button>
            {/* History button */}
            <button
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-indigo-500 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Today's History
            </button>
            {/* Log out — far right */}
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Log out
            </button>
          </div>
        </div>

        {/* New list panel */}
        {showNewList && (
          <div className="mb-5 p-4 bg-indigo-50 rounded-xl border border-indigo-100 flex gap-2 items-center">
            <input
              autoFocus
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={handleNewListKeyDown}
              placeholder="List name…"
              className="flex-1 bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              onClick={createList}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              Create
            </button>
            <button
              onClick={() => { setShowNewList(false); setNewListName(""); }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* No lists yet — prompt to create first */}
        {!loading && lists.length === 0 && !showNewList && (
          <div className="text-center py-16">
            <p className="text-gray-400 text-sm mb-4">You don't have any lists yet.</p>
            <button
              onClick={() => setShowNewList(true)}
              className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Create your first list
            </button>
          </div>
        )}

        {/* List tabs */}
        {lists.length > 0 && (
          <div className="flex gap-2 mb-5 flex-wrap">
            {lists.map((list) => (
              <div key={list} className="flex items-center gap-0.5">
                <button
                  onClick={() => setActiveList(list)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    activeList === list
                      ? "bg-indigo-600 text-white"
                      : "bg-indigo-50 text-indigo-400 hover:bg-indigo-100"
                  }`}
                >
                  {displayName(list)}
                </button>
                {/* Delete list button */}
                {(
                  <button
                    onClick={() => deleteList(list)}
                    title="Delete list"
                    className={`w-4 h-4 flex items-center justify-center rounded-full transition-colors ${
                      activeList === list ? "text-indigo-200 hover:text-white" : "text-gray-300 hover:text-red-400"
                    }`}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-sm text-gray-400 mb-6">
          {loading
            ? "Loading your tasks…"
            : activeTodos.length === 0
            ? "No tasks yet — add one below!"
            : `${remaining} of ${activeTodos.length} task${activeTodos.length !== 1 ? "s" : ""} remaining`}
        </p>

        {/* Input + Todo list + Footer — only when a list is active */}
        {activeList && (<>
          {/* Input */}
          <div className="flex gap-2 mb-6">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Add to "${displayName(activeList)}"…`}
              className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              onClick={addTodo}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Add
            </button>
          </div>

          {/* Todo list */}
          <ul className="space-y-2">
            {loading && (
              <li className="text-center text-gray-300 py-8 text-sm animate-pulse">Loading…</li>
            )}
            {!loading && activeTodos.length === 0 && (
              <li className="text-center text-gray-300 py-8 text-sm">Your list is empty ✨</li>
            )}
            {activeTodos.map((todo) => (
              <li
                key={todo.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-indigo-100 hover:bg-indigo-50 transition-colors group"
              >
                <button
                  onClick={() => toggleTodo(todo.id)}
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    todo.completed ? "bg-indigo-500 border-indigo-500" : "border-gray-300 hover:border-indigo-400"
                  }`}
                >
                  {todo.completed && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <span className={`block text-sm ${todo.completed ? "line-through text-gray-300" : "text-gray-700"}`}>
                    {todo.text}
                  </span>
                  <span className="text-xs text-gray-300">Added {formatDate(todo.createdAt)}</span>
                </div>
                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="text-gray-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  aria-label="Delete task"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>

          {/* Footer actions */}
          <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-50">
            <div className="flex items-center gap-3">
              {hasCompleted && (
                <button onClick={clearCompleted} className="text-xs text-gray-400 hover:text-red-400 transition-colors">
                  Clear completed
                </button>
              )}
              {activeTodos.length > 0 && (
                <button onClick={clearAllTasks} className="text-xs text-gray-400 hover:text-red-400 transition-colors">
                  Clear all tasks
                </button>
              )}
              <button onClick={() => deleteList(activeList)} className="text-xs text-gray-400 hover:text-red-500 transition-colors font-medium">
                Delete list
              </button>
            </div>
            {canUndo && (
              <button onClick={undo} className="flex items-center gap-1.5 text-xs font-medium text-indigo-500 hover:text-indigo-700 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                Undo
              </button>
            )}
          </div>
        </>)}
      </div>

      {/* History panel */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowHistory(false)} />
          <div className="relative bg-white w-full max-w-sm h-full shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Today's History</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  {" · "}{displayName(activeList)}
                </p>
              </div>
              <button onClick={() => setShowHistory(false)} className="text-gray-300 hover:text-gray-500 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {allTodayTasks.length === 0 ? (
                <div className="text-center text-gray-300 py-16 text-sm">No tasks added today yet</div>
              ) : (
                <ul className="space-y-3">
                  {allTodayTasks.map((task) => {
                    const isRemoved = removedTodayIds.has(task.id) && !activeTodayIds.has(task.id);
                    const isCompleted = !isRemoved && task.completed;
                    return (
                      <li key={task.id} className="flex items-start gap-3">
                        <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${isRemoved ? "bg-red-300" : isCompleted ? "bg-green-400" : "bg-indigo-400"}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${isRemoved ? "line-through text-gray-300" : "text-gray-700"}`}>{task.text}</p>
                          <p className="text-xs text-gray-300 mt-0.5">Added at {formatTime(task.createdAt)}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-xs mt-0.5 ${isRemoved ? "text-red-300" : isCompleted ? "text-green-400" : "text-indigo-300"}`}>
                            {isRemoved ? "removed" : isCompleted ? "done" : "active"}
                          </span>
                          {isRemoved && (
                            <button onClick={() => restoreTask(task)} title="Restore task" className="text-gray-300 hover:text-indigo-500 transition-colors">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 text-xs text-gray-300 flex gap-4">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" /> active</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> done</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-300 inline-block" /> removed</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
