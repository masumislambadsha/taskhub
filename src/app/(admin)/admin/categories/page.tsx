"use client";
import iconMap from '@/lib/iconMap';
import { MdAdd, MdCategory, MdClose, MdDelete, MdEdit, MdOpenInNew, MdTaskAlt, MdTrendingUp } from 'react-icons/md';

import { useEffect, useState } from "react";

interface Category {
  _id: string;
  name: string;
  icon: string;
}

interface CategoryStats {
  _id: string;
  count: number;
  open: number;
}

const ICON_OPTIONS = [
  "category",
  "share",
  "videocam",
  "edit_note",
  "bug_report",
  "search",
  "table_rows",
  "shopping_bag",
  "code",
  "design_services",
  "translate",
  "photo_camera",
  "headphones",
  "school",
  "analytics",
];

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<Record<string, CategoryStats>>({});
  const [totalTasks, setTotalTasks] = useState(0);
  const [loading, setLoading] = useState(true);

  
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [formName, setFormName] = useState("");
  const [formIcon, setFormIcon] = useState("category");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadCategories() {
    setLoading(true);
    const res = await fetch("/api/v1/admin/categories");
    const data = await res.json();
    setCategories(data.categories ?? []);
    const map: Record<string, CategoryStats> = {};
    let total = 0;
    (data.taskStats ?? []).forEach((c: CategoryStats) => {
      map[c._id] = c;
      total += c.count;
    });
    setStats(map);
    setTotalTasks(total);
    setLoading(false);
  }

  useEffect(() => {
    loadCategories();
  }, []);

  function openAdd() {
    setEditTarget(null);
    setFormName("");
    setFormIcon("category");
    setError("");
    setShowModal(true);
  }

  function openEdit(cat: Category) {
    setEditTarget(cat);
    setFormName(cat.name);
    setFormIcon(cat.icon);
    setError("");
    setShowModal(true);
  }

  async function handleSave() {
    if (!formName.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const url = editTarget
        ? `/api/v1/admin/categories/${editTarget._id}`
        : "/api/v1/admin/categories";
      const method = editTarget ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName.trim(), icon: formIcon }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }
      setShowModal(false);
      loadCategories();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(cat: Category) {
    if (!confirm(`Delete "${cat.name}"? This won't delete existing tasks.`))
      return;
    await fetch(`/api/v1/admin/categories/${cat._id}`, { method: "DELETE" });
    loadCategories();
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-headline text-2xl font-bold text-primary">
            Category Management
          </h1>
          <p className="text-primary/60 text-sm mt-1">
            Manage task categories and their performance
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm self-start sm:self-auto sm:w-auto w-full"
        >
          <MdAdd className="text-sm" />
          Add Category
        </button>
      </div>

      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 sm:p-6 border border-primary/5 shadow-sm">
          <MdCategory className="text-secondary text-2xl" />
          <div className="text-2xl sm:text-3xl font-bold font-headline text-primary">
            {categories.length}
          </div>
          <div className="text-sm text-primary/60 mt-1">Total Categories</div>
        </div>
        <div className="bg-white rounded-xl p-4 sm:p-6 border border-primary/5 shadow-sm">
          <MdTaskAlt className="text-sm" />
          <div className="text-2xl sm:text-3xl font-bold font-headline text-primary">
            {totalTasks}
          </div>
          <div className="text-sm text-primary/60 mt-1">Total Tasks</div>
        </div>
        <div className="bg-white rounded-xl p-4 sm:p-6 border border-primary/5 shadow-sm">
          <MdTrendingUp className="text-secondary text-2xl" />
          <div className="text-lg sm:text-2xl font-bold font-headline text-primary truncate">
            {Object.values(stats).sort((a, b) => b.count - a.count)[0]?._id ??
              "—"}
          </div>
          <div className="text-sm text-primary/60 mt-1">Top Category</div>
        </div>
        <div className="bg-primary rounded-xl p-4 sm:p-6 border border-primary shadow-sm">
          <MdOpenInNew className="text-secondary text-2xl" />
          <div className="text-2xl sm:text-3xl font-bold font-headline text-white">
            {Object.values(stats).reduce((s, c) => s + c.open, 0)}
          </div>
          <div className="text-sm text-white/70 mt-1">Open Tasks</div>
        </div>
      </div>

      
      <div className="bg-white rounded-xl border border-primary/5 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-primary/5 flex items-center justify-between">
          <h2 className="font-bold text-primary">All Categories</h2>
          <span className="text-xs text-primary/40">
            {categories.length} categories
          </span>
        </div>
        {loading ? (
          <div className="px-4 sm:px-6 py-12 text-center text-primary/40">
            Loading...
          </div>
        ) : (
          <div className="divide-y divide-primary/5">
            {categories.map((cat) => {
              const data = stats[cat.name];
              const count = data?.count ?? 0;
              const open = data?.open ?? 0;
              const pct =
                totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;
              return (
                <div
                  key={cat._id}
                  className="px-4 sm:px-6 py-4 sm:py-5 flex items-center gap-3 sm:gap-5 hover:bg-slate-50 transition-colors"
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
                    {(() => { const Icon = iconMap[cat.icon] ?? MdCategory; return <Icon className="text-base text-secondary" />; })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <p className="font-bold text-primary truncate">
                        {cat.name}
                      </p>
                      <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm shrink-0">
                        <span className="text-primary/60">{count} tasks</span>
                        <span className="text-secondary font-semibold">
                          {open} open
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-primary/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-secondary rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-primary/30 mt-1">
                      {pct}% of all tasks
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(cat)}
                      className="p-2 rounded-lg hover:bg-primary/5 text-primary/40 hover:text-primary transition-colors"
                    >
                      <MdEdit className="text-sm" />
                    </button>
                    <button
                      onClick={() => handleDelete(cat)}
                      className="p-2 rounded-lg hover:bg-red-50 text-primary/40 hover:text-red-500 transition-colors"
                    >
                      <MdDelete className="text-sm" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-primary">
                {editTarget ? "Edit Category" : "Add Category"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-primary/40 hover:text-primary"
              >
                <MdClose className="text-sm" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Graphic Design"
                  className="w-full border border-primary/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/40"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-2">
                  Icon
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {ICON_OPTIONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setFormIcon(icon)}
                      className={`p-2 rounded-lg border flex items-center justify-center transition-colors ${
                        formIcon === icon
                          ? "border-secondary bg-secondary/10 text-secondary"
                          : "border-primary/10 hover:border-secondary/40 text-primary/50"
                      }`}
                      title={icon}
                    >
                      <MdCategory className="text-secondary text-xl" />
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border border-primary/20 text-primary rounded-lg py-2.5 text-sm font-medium hover:bg-primary/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-primary text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {saving
                  ? "Saving..."
                  : editTarget
                    ? "Save Changes"
                    : "Add Category"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



