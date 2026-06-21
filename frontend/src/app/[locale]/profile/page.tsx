"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { CheckCircle2, BarChart3 } from "lucide-react";

export default function ProfilePage({ params: { locale } }: { params: { locale: string } }) {
  const t = useTranslations("profile");
  const router = useRouter();
  const { fetchMe } = useAuthStore();
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [height, setHeight] = useState("");
  const [activityLevel, setActivityLevel] = useState("");
  const [language, setLanguage] = useState(locale);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heightError, setHeightError] = useState<string | null>(null);
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [stats, setStats] = useState<{ workouts: number; photos: number; reports: number } | null>(null);

  useEffect(() => {
    api.get("/api/v1/users/me").then((r) => {
      const u = r.data;
      setFullName(u.full_name ?? "");
      setGender(u.gender ?? "");
      setBirthDate(u.birth_date ? u.birth_date.slice(0, 10) : "");
      setHeight(u.height_cm ? String(u.height_cm) : "");
      setActivityLevel(u.activity_level ?? "");
      setLanguage(u.preferred_language ?? locale);
      if (u.created_at) {
        setMemberSince(
          new Date(u.created_at).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        );
      }
    });

    Promise.all([
      api.get("/api/v1/analytics/workout-analytics"),
      api.get("/api/v1/photos"),
      api.get("/api/v1/reports?limit=200"),
    ]).then(([w, p, r]) => {
      setStats({
        workouts: w.data.total_workouts ?? 0,
        photos: p.data.length ?? 0,
        reports: r.data.length ?? 0,
      });
    }).catch(() => {});
  }, [locale]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(false);
    setError(null);
    setHeightError(null);

    if (height) {
      const h = parseFloat(height);
      if (isNaN(h) || h < 100 || h > 250) {
        setHeightError(t("heightError"));
        return;
      }
    }

    setLoading(true);
    try {
      await api.put("/api/v1/users/me", {
        full_name: fullName.trim() || undefined,
        gender: gender || undefined,
        birth_date: birthDate || undefined,
        height_cm: height ? parseFloat(height) : undefined,
        activity_level: activityLevel || undefined,
        preferred_language: language,
      });
      await fetchMe();
      setSuccess(true);
      if (language !== locale) {
        router.push(`/${language}/profile`);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || t("errorMsg"));
    } finally { setLoading(false); }
  }

  const selectClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <AppLayout locale={locale}>
      <div className="space-y-6 max-w-lg">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">{t("fullName")}</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender">{t("gender")}</Label>
                <select
                  id="gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className={selectClass}
                >
                  <option value="">—</option>
                  <option value="male">{t("male")}</option>
                  <option value="female">{t("female")}</option>
                  <option value="other">{t("other")}</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="birthDate">{t("birthDate")}</Label>
                <Input
                  id="birthDate"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                />
                <p className="text-xs text-muted-foreground">{t("birthDateHint")}</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="height">{t("height")}</Label>
                <Input
                  id="height"
                  type="number"
                  step="0.1"
                  min="100"
                  max="250"
                  value={height}
                  onChange={(e) => { setHeight(e.target.value); setHeightError(null); }}
                  className={heightError ? "border-destructive" : ""}
                />
                {heightError && <p className="text-xs text-destructive">{heightError}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="activityLevel">{t("activityLevel")}</Label>
                <select
                  id="activityLevel"
                  value={activityLevel}
                  onChange={(e) => setActivityLevel(e.target.value)}
                  className={selectClass}
                >
                  <option value="">—</option>
                  {(["sedentary", "lightly_active", "moderately_active", "very_active", "extremely_active"] as const).map((a) => (
                    <option key={a} value={a}>{t(a)}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">{t("language")}</Label>
                <select
                  id="language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className={selectClass}
                >
                  <option value="tr">Türkçe</option>
                  <option value="en">English</option>
                </select>
              </div>

              {success && (
                <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {t("successMsg")}
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "..." : t("updateProfile")}
              </Button>
            </form>
          </CardContent>
        </Card>
        {/* ── Account Stats ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" />
              {t("statsTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {memberSince && (
                <div className="rounded-lg border bg-muted/30 px-3 py-3">
                  <p className="text-xs text-muted-foreground mb-1">{t("memberSince")}</p>
                  <p className="text-sm font-semibold">{memberSince}</p>
                </div>
              )}
              {stats != null && (
                <>
                  <div className="rounded-lg border bg-muted/30 px-3 py-3 text-center">
                    <p className="text-2xl font-bold text-primary">{stats.workouts}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("totalWorkouts")}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 px-3 py-3 text-center">
                    <p className="text-2xl font-bold text-pink-500">{stats.photos}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("totalPhotos")}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 px-3 py-3 text-center">
                    <p className="text-2xl font-bold text-indigo-500">{stats.reports}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("totalReports")}</p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
