"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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
}

// Shape of a row coming back from Supabase
interface TodoRow {
  id: number;
  text: string;
  completed: boolean;
  created_at: string;
}

function rowToTodo(row: TodoRow): Todo {
  return { id: row.id, text: row.text, completed: row.completed, createdAt: new Date(row.created_at) };
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

const MAX_UNDO = 10;

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState("");
  const [undoStack, setUndoStack] = useState<Todo[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);

  // ---------- load from Supabase on mount ----------

  useEffect(() => {
    const fetchTodos = async () => {
      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .order("created_at", { ascending: true });

      if (!error && data) setTodos((data as TodoRow[]).map(rowToTodo));
      setLoading(false);
    };
    fetchTodos();
  }, []);

  // ---------- helpers ----------

  const pushUndo = (task: Todo) => {
    setUndoStack((prev) => [task, ...prev].slice(0, MAX_UNDO));
  };

  // ---------- actions ----------

  const addTodo = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput("");

    const { data, error } = await supabase
      .from("todos")
      .insert({ text: trimmed, completed: false })
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
    const completed = todos.filter((t) => t.completed);
    const ids = completed.map((t) => t.id);
    const { error } = await supabase.from("todos").delete().in("id", ids);
    if (!error) {
      completed.forEach((t) => pushUndo(t));
      setTodos((prev) => prev.filter((t) => !t.completed));
    }
  };

  // Undo: restore most recently removed task by re-inserting into Supabase
  const undo = async () => {
    if (!undoStack.length) return;
    const [latest, ...rest] = undoStack;

    const { data, error } = await supabase
      .from("todos")
      .insert({ text: latest.text, completed: false, created_at: latest.createdAt.toISOString() })
      .select()
      .single();

    if (!error && data) {
      setTodos((prev) => [...prev, rowToTodo(data as TodoRow)]);
      setUndoStack(rest);
    }
  };

  // Restore a specific task from the history panel
  const restoreTask = async (task: Todo) => {
    const { data, error } = await supabase
      .from("todos")
      .insert({ text: task.text, completed: false, created_at: task.createdAt.toISOString() })
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

  // ---------- derived ----------

  const remaining = todos.filter((t) => !t.completed).length;
  const hasCompleted = todos.some((t) => t.completed);
  const canUndo = undoStack.length > 0;

  const removedTodayIds = new Set(undoStack.filter((t) => isToday(t.createdAt)).map((t) => t.id));
  const activeTodayIds = new Set(todos.filter((t) => isToday(t.createdAt)).map((t) => t.id));

  const allTodayTasks = [
    ...todos.filter((t) => isToday(t.createdAt)),
    ...undoStack.filter((t) => isToday(t.createdAt) && !activeTodayIds.has(t.id)),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  // ---------- render ----------

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex flex-col items-center justify-center p-4 gap-6">

      {/* Motivational quote */}
      <div className="w-full max-w-md text-center px-2">
        <p className="text-base text-indigo-500 italic">"{quote.text}"</p>
        <p className="text-xs text-indigo-300 mt-1">— {quote.author}</p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 relative">

        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <h1 className="text-3xl font-bold text-indigo-600">Things To-do</h1>
          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-indigo-500 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors mt-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Today's History
          </button>
        </div>

        <p className="text-sm text-gray-400 mb-6">
          {loading
            ? "Loading your tasks..."
            : todos.length === 0
            ? "No tasks yet — add one below!"
            : `${remaining} of ${todos.length} task${todos.length !== 1 ? "s" : ""} remaining`}
        </p>

        {/* Input */}
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What needs to be done?"
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
            <li className="text-center text-gray-300 py-8 text-sm animate-pulse">
              Loading…
            </li>
          )}
          {!loading && todos.length === 0 && (
            <li className="text-center text-gray-300 py-8 text-sm">
              Your list is empty ✨
            </li>
          )}
          {todos.map((todo) => (
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
        {(hasCompleted || canUndo) && (
          <div className="flex items-center justify-between mt-4">
            {hasCompleted ? (
              <button onClick={clearCompleted} className="text-xs text-gray-400 hover:text-red-400 transition-colors">
                Clear completed
              </button>
            ) : <span />}

            {canUndo && (
              <button onClick={undo} className="flex items-center gap-1.5 text-xs font-medium text-indigo-500 hover:text-indigo-700 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                Undo
              </button>
            )}
          </div>
        )}
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
                      <li key={task.id} className="flex items-start gap-3 group">
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
