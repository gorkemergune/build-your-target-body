"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  X,
  Search,
  Star,
  Clock,
  BookTemplate,
  Plus,
  Check,
  Trash2,
  Loader2,
  ChefHat,
  BarChart2,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface FoodItem {
  id: number;
  name: string;
  brand: string | null;
  calories_per_serving: number;
  protein_g_per_serving: number;
  carbs_g_per_serving: number;
  fat_g_per_serving: number;
  serving_size_g: number | null;
  is_favorite: boolean;
  use_count: number;
}

interface TemplateItem {
  food_name: string;
  name?: string;
  food_item_id?: number;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  quantity_g?: number;
}

interface MealTemplate {
  id: number;
  name: string;
  items: TemplateItem[];
  item_count: number;
  total_calories: number;
  created_at: string;
}

interface Props {
  locale: string;
  currentDate: string;
  mealType: string;
  logId: number | null;
  onAdded: (newLogId?: number) => void;
  onClose: () => void;
}

type Tab = "recent" | "favorites" | "search" | "templates" | "create";

// ── Helpers ───────────────────────────────────────────────────────────────────

function MacroChip({ cal, p, c, f }: { cal: number; p: number; c: number; f: number }) {
  return (
    <span className="text-[10px] text-muted-foreground">
      <span className="font-medium text-foreground">{Math.round(cal)}</span> kcal
      {" · "}P <span className="text-blue-600 dark:text-blue-400">{Math.round(p)}</span>
      {" · "}C <span className="text-amber-600 dark:text-amber-400">{Math.round(c)}</span>
      {" · "}F <span className="text-rose-600 dark:text-rose-400">{Math.round(f)}</span>
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function FoodLibraryModal({ locale, currentDate, mealType, logId, onAdded, onClose }: Props) {
  const t = useTranslations("foodLibrary");

  const [tab, setTab] = useState<Tab>("recent");
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<FoodItem[]>([]);
  const [favorites, setFavorites] = useState<FoodItem[]>([]);
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [templates, setTemplates] = useState<MealTemplate[]>([]);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [togglingFavId, setTogglingFavId] = useState<number | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<number | null>(null);
  const [loggingTemplateId, setLoggingTemplateId] = useState<number | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Create food form
  const [createName, setCreateName] = useState("");
  const [createBrand, setCreateBrand] = useState("");
  const [createCal, setCreateCal] = useState("");
  const [createProtein, setCreateProtein] = useState("");
  const [createCarbs, setCreateCarbs] = useState("");
  const [createFat, setCreateFat] = useState("");
  const [createServing, setCreateServing] = useState("");
  const [creating, setCreating] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load initial data
  useEffect(() => {
    api.get("/api/v1/foods/recent").then((r) => setRecent(r.data)).catch(() => {});
    api.get("/api/v1/foods/favorites").then((r) => setFavorites(r.data)).catch(() => {});
    api.get("/api/v1/meal-templates").then((r) => setTemplates(r.data)).catch(() => {});
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!query.trim()) { setSearchResults([]); return; }
    setTab("search");
    setSearchLoading(true);
    searchTimer.current = setTimeout(() => {
      api.get(`/api/v1/foods?q=${encodeURIComponent(query.trim())}&limit=30`)
        .then((r) => setSearchResults(r.data))
        .catch(() => {})
        .finally(() => setSearchLoading(false));
    }, 280);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [query]);

  async function ensureLog(): Promise<number> {
    if (logId) return logId;
    const res = await api.post("/api/v1/nutrition", { logged_date: currentDate });
    return res.data.id;
  }

  async function addFood(item: FoodItem) {
    setAddingId(item.id);
    try {
      const lid = await ensureLog();
      await api.post(`/api/v1/nutrition/${lid}/foods`, {
        meal_type: mealType,
        food_name: item.name,
        calories: item.calories_per_serving,
        protein_g: item.protein_g_per_serving,
        carbs_g: item.carbs_g_per_serving,
        fat_g: item.fat_g_per_serving,
        food_item_id: item.id,
      });
      setAddedIds((prev) => new Set(prev).add(item.id));
      // Update recent list
      setRecent((prev) => {
        const without = prev.filter((x) => x.id !== item.id);
        return [{ ...item, use_count: item.use_count + 1 }, ...without].slice(0, 20);
      });
      onAdded(lid);
    } catch {
      /* silently ignore */
    } finally {
      setAddingId(null);
    }
  }

  async function toggleFavorite(item: FoodItem) {
    setTogglingFavId(item.id);
    try {
      const res = await api.post(`/api/v1/foods/${item.id}/favorite`);
      const updated: FoodItem = res.data;
      const update = (list: FoodItem[]) => list.map((x) => (x.id === item.id ? updated : x));
      setRecent(update);
      setSearchResults(update);
      if (updated.is_favorite) {
        setFavorites((prev) => [updated, ...prev.filter((x) => x.id !== item.id)]);
      } else {
        setFavorites((prev) => prev.filter((x) => x.id !== item.id));
      }
    } catch {
      /* ignore */
    } finally {
      setTogglingFavId(null);
    }
  }

  async function deleteFood(item: FoodItem) {
    if (!confirm(t("deleteConfirm"))) return;
    try {
      await api.delete(`/api/v1/foods/${item.id}`);
      const remove = (list: FoodItem[]) => list.filter((x) => x.id !== item.id);
      setRecent(remove);
      setFavorites(remove);
      setSearchResults(remove);
    } catch {
      /* ignore */
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const res = await api.post("/api/v1/foods", {
        name: createName.trim(),
        brand: createBrand.trim() || null,
        calories_per_serving: parseFloat(createCal) || 0,
        protein_g_per_serving: parseFloat(createProtein) || 0,
        carbs_g_per_serving: parseFloat(createCarbs) || 0,
        fat_g_per_serving: parseFloat(createFat) || 0,
        serving_size_g: parseFloat(createServing) || null,
      });
      const newItem: FoodItem = res.data;
      setRecent((prev) => [newItem, ...prev]);
      setCreateName(""); setCreateBrand(""); setCreateCal(""); setCreateProtein("");
      setCreateCarbs(""); setCreateFat(""); setCreateServing("");
      setCreateSuccess(true);
      setTimeout(() => setCreateSuccess(false), 2000);
    } catch {
      /* ignore */
    } finally {
      setCreating(false);
    }
  }

  async function logTemplate(tpl: MealTemplate) {
    setLoggingTemplateId(tpl.id);
    try {
      const lid = await ensureLog();
      await api.post(`/api/v1/meal-templates/${tpl.id}/log`, {
        logged_date: currentDate,
        meal_type: mealType,
      });
      onAdded(lid);
    } catch {
      /* ignore */
    } finally {
      setLoggingTemplateId(null);
    }
  }

  async function deleteTemplate(tpl: MealTemplate) {
    if (!confirm(t("deleteConfirm"))) return;
    setDeletingTemplateId(tpl.id);
    try {
      await api.delete(`/api/v1/meal-templates/${tpl.id}`);
      setTemplates((prev) => prev.filter((x) => x.id !== tpl.id));
    } catch {
      /* ignore */
    } finally {
      setDeletingTemplateId(null);
    }
  }

  const displayItems: FoodItem[] =
    tab === "recent" ? recent :
    tab === "favorites" ? favorites :
    tab === "search" ? searchResults : [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-2 sm:p-4">
      <div className="relative w-full max-w-lg bg-background rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b shrink-0">
          <ChefHat className="h-5 w-5 text-primary shrink-0" />
          <h2 className="font-semibold flex-1">{t("title")}</h2>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium capitalize">{mealType}</span>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2.5 border-b shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 px-3 pt-2 pb-0 shrink-0 overflow-x-auto">
          {([
            ["recent", <Clock key="c" className="h-3 w-3" />, t("recent")],
            ["favorites", <Star key="s" className="h-3 w-3" />, t("favorites")],
            ["search", <Search key="q" className="h-3 w-3" />, t("searchTab")],
            ["templates", <BookTemplate key="b" className="h-3 w-3" />, t("templates")],
            ["create", <Plus key="p" className="h-3 w-3" />, t("createFood")],
          ] as [Tab, React.ReactNode, string][]).map(([id, icon, label]) => (
            <button
              key={id}
              onClick={() => { if (id !== "search") setQuery(""); setTab(id); }}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-t-lg whitespace-nowrap transition-colors border-b-2 ${
                tab === id
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {icon}{label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-3 py-2">

          {/* Food list tabs */}
          {(tab === "recent" || tab === "favorites" || tab === "search") && (
            <div>
              {tab === "search" && searchLoading && (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {tab === "search" && !searchLoading && query.trim() && searchResults.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">{t("noResults")}</p>
              )}
              {tab === "search" && !query.trim() && (
                <p className="text-center text-sm text-muted-foreground py-6">{t("typeToSearch")}</p>
              )}
              {tab === "recent" && recent.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">{t("noRecent")}</p>
              )}
              {tab === "favorites" && favorites.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-6">{t("noFavorites")}</p>
              )}
              <div className="space-y-0.5">
                {displayItems.map((item) => (
                  <FoodRow
                    key={item.id}
                    item={item}
                    added={addedIds.has(item.id)}
                    adding={addingId === item.id}
                    togglingFav={togglingFavId === item.id}
                    onAdd={() => addFood(item)}
                    onToggleFav={() => toggleFavorite(item)}
                    onDelete={() => deleteFood(item)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Templates tab */}
          {tab === "templates" && (
            <div className="space-y-2">
              {templates.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground">{t("noTemplates")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("noTemplatesHint")}</p>
                </div>
              )}
              {templates.map((tpl) => (
                <div key={tpl.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tpl.name}</p>
                      <MacroChip
                        cal={tpl.total_calories}
                        p={tpl.items.reduce((s, i) => s + (i.protein_g || 0), 0)}
                        c={tpl.items.reduce((s, i) => s + (i.carbs_g || 0), 0)}
                        f={tpl.items.reduce((s, i) => s + (i.fat_g || 0), 0)}
                      />
                      <div className="mt-1 space-y-0.5">
                        {tpl.items.map((item, idx) => (
                          <p key={idx} className="text-[10px] text-muted-foreground">
                            • {item.food_name || item.name}
                            {item.calories ? ` — ${Math.round(item.calories)} kcal` : ""}
                          </p>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        className="h-7 px-2.5 text-xs"
                        disabled={loggingTemplateId === tpl.id}
                        onClick={() => logTemplate(tpl)}
                      >
                        {loggingTemplateId === tpl.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : t("logTemplate")}
                      </Button>
                      <button
                        onClick={() => deleteTemplate(tpl)}
                        disabled={deletingTemplateId === tpl.id}
                        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        {deletingTemplateId === tpl.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Trash2 className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create Food tab */}
          {tab === "create" && (
            <form onSubmit={handleCreate} className="space-y-3 pb-2">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("foodName")} *</Label>
                <Input
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder={t("foodNamePlaceholder")}
                  maxLength={200}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("brand")}</Label>
                <Input
                  value={createBrand}
                  onChange={(e) => setCreateBrand(e.target.value)}
                  placeholder={t("brandPlaceholder")}
                  maxLength={100}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {([
                  [t("caloriesPerServing"), createCal, setCreateCal],
                  [t("proteinPerServing"), createProtein, setCreateProtein],
                  [t("carbsPerServing"), createCarbs, setCreateCarbs],
                  [t("fatPerServing"), createFat, setCreateFat],
                ] as [string, string, React.Dispatch<React.SetStateAction<string>>][]).map(([label, val, setter]) => (
                  <div key={label} className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">{label}</Label>
                    <Input
                      type="number" step="0.1" min="0"
                      value={val}
                      onChange={(e) => setter(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("servingSize")}</Label>
                <Input
                  type="number" step="0.1" min="0"
                  value={createServing}
                  onChange={(e) => setCreateServing(e.target.value)}
                  placeholder="100"
                  className="h-8 text-sm"
                />
              </div>
              <Button type="submit" className="w-full" disabled={creating || !createName.trim()}>
                {creating
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : createSuccess
                  ? <><Check className="h-4 w-4 mr-1" />{t("saved")}</>
                  : t("saveFood")}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Food Row ──────────────────────────────────────────────────────────────────

function FoodRow({
  item,
  added,
  adding,
  togglingFav,
  onAdd,
  onToggleFav,
  onDelete,
}: {
  item: FoodItem;
  added: boolean;
  adding: boolean;
  togglingFav: boolean;
  onAdd: () => void;
  onToggleFav: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("foodLibrary");
  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/40 transition-colors group">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <p className="text-sm font-medium truncate">{item.name}</p>
          {item.brand && <span className="text-[10px] text-muted-foreground shrink-0">{item.brand}</span>}
        </div>
        <MacroChip
          cal={item.calories_per_serving}
          p={item.protein_g_per_serving}
          c={item.carbs_g_per_serving}
          f={item.fat_g_per_serving}
        />
        {item.serving_size_g && (
          <span className="text-[10px] text-muted-foreground"> · {item.serving_size_g}g {t("perServing")}</span>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onToggleFav}
          disabled={togglingFav}
          className={`p-1 transition-colors ${item.is_favorite ? "text-amber-500" : "text-muted-foreground hover:text-amber-500"}`}
          title={item.is_favorite ? t("unfavorite") : t("favorite")}
        >
          {togglingFav
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Star className={`h-3.5 w-3.5 ${item.is_favorite ? "fill-current" : ""}`} />}
        </button>
        <button
          onClick={onDelete}
          className="p-1 text-muted-foreground hover:text-destructive transition-colors"
          title={t("delete")}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <Button
        size="sm"
        variant={added ? "outline" : "default"}
        className="h-7 w-14 text-xs shrink-0"
        disabled={adding}
        onClick={onAdd}
      >
        {adding
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : added
          ? <Check className="h-3 w-3 text-green-600" />
          : t("add")}
      </Button>
    </div>
  );
}
