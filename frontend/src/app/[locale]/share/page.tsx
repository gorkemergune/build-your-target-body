"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Download, Share2, X, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import {
  CARD_THEMES,
  MilestoneType,
  ShareCardData,
  downloadCard,
  drawShareCard,
  nativeShare,
} from "@/lib/shareCard";

type Privacy = "anonymous" | "first_name" | "full_name";

interface Milestone {
  id: string;
  type: MilestoneType;
  metric: string;
  title: string;
  subtitle: string;
  share_text: string;
}

interface MilestonesResponse {
  milestones: Milestone[];
  full_name: string;
  first_name: string;
}

function MilestonePreviewCard({
  m,
  onShare,
}: {
  m: Milestone;
  onShare: (m: Milestone) => void;
}) {
  const theme = CARD_THEMES[m.type];

  return (
    <div className="rounded-2xl overflow-hidden shadow-lg border border-border/40">
      {/* Visual preview */}
      <div
        className="flex flex-col items-center justify-center gap-1 p-6 min-h-[180px] text-white select-none"
        style={{ background: theme.cssGradient }}
      >
        <span className="text-4xl">{theme.emoji}</span>
        <span className="text-3xl font-black tracking-tight mt-1">{m.metric}</span>
        <span className="text-base font-bold opacity-90">{m.title}</span>
        <span className="text-xs opacity-65 text-center">{m.subtitle}</span>
      </div>

      {/* Actions */}
      <div className="bg-card p-3 flex gap-2">
        <button
          onClick={() => onShare(m)}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium py-2 hover:opacity-90 transition-opacity"
        >
          <Share2 className="h-3.5 w-3.5" />
          Share
        </button>
      </div>
    </div>
  );
}

function ShareOverlay({
  milestone,
  cardData,
  shareText,
  onClose,
}: {
  milestone: Milestone;
  cardData: ShareCardData;
  shareText: string;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [showNativeShare, setShowNativeShare] = useState(false);

  useEffect(() => {
    if (canvasRef.current) {
      drawShareCard(canvasRef.current, cardData);
    }
    setShowNativeShare(typeof navigator !== "undefined" && "share" in navigator);
  }, [cardData]);

  const handleDownload = async () => {
    if (!canvasRef.current) return;
    setDownloading(true);
    const slug = milestone.id.replace(/_/g, "-");
    await downloadCard(canvasRef.current, `bytb-${slug}.png`);
    setDownloading(false);
  };

  const handleNativeShare = async () => {
    if (!canvasRef.current) return;
    const shared = await nativeShare(canvasRef.current, shareText);
    if (!shared) handleDownload();
  };

  const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="bg-card rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-sm">{milestone.title}</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Canvas preview */}
        <div className="flex justify-center bg-muted/30 p-4">
          <canvas
            ref={canvasRef}
            style={{ width: 300, height: 300, borderRadius: 12 }}
          />
        </div>

        <div className="p-4 flex flex-col gap-3">
          {/* Primary action */}
          {showNativeShare ? (
            <button
              onClick={handleNativeShare}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-semibold py-3 hover:opacity-90 transition-opacity"
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
          ) : (
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-semibold py-3 hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {downloading ? "Generating..." : "Download PNG"}
            </button>
          )}

          {/* Social links */}
          <div className="grid grid-cols-2 gap-2">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              WhatsApp
            </a>
            <a
              href={xUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              X / Twitter
            </a>
          </div>

          {showNativeShare && (
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-border py-2 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-60"
            >
              <Download className="h-3.5 w-3.5" />
              {downloading ? "Generating..." : "Download PNG"}
            </button>
          )}

          <p className="text-xs text-muted-foreground text-center">
            For Instagram Stories: download the image and share it manually
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SharePage({ params }: { params: { locale: string } }) {
  const t = useTranslations("share");
  const [data, setData] = useState<MilestonesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [privacy, setPrivacy] = useState<Privacy>("first_name");
  const [selected, setSelected] = useState<Milestone | null>(null);

  useEffect(() => {
    api
      .get("/api/v1/share/milestones")
      .then((r) => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const getDisplayName = useCallback((): string => {
    if (!data) return "";
    if (privacy === "anonymous") return "";
    if (privacy === "first_name") return data.first_name;
    return data.full_name;
  }, [data, privacy]);

  const buildCardData = useCallback(
    (m: Milestone): ShareCardData => ({
      type: m.type,
      metric: m.metric,
      title: m.title,
      subtitle: m.subtitle,
      displayName: getDisplayName(),
    }),
    [getDisplayName]
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      {/* Privacy selector */}
      <div className="bg-card rounded-xl border p-4 space-y-3">
        <p className="text-sm font-medium">{t("privacy.label")}</p>
        <div className="flex gap-2 flex-wrap">
          {(["anonymous", "first_name", "full_name"] as Privacy[]).map((p) => (
            <button
              key={p}
              onClick={() => setPrivacy(p)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                privacy === p
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(`privacy.${p}`)}
            </button>
          ))}
        </div>
        {privacy !== "anonymous" && data && (
          <p className="text-xs text-muted-foreground">
            {t("privacy.preview")}:{" "}
            <span className="font-medium text-foreground">{getDisplayName()}</span>
          </p>
        )}
      </div>

      {/* Milestones */}
      {loading ? (
        <div className="flex justify-center py-12 text-muted-foreground text-sm">
          {t("loading")}
        </div>
      ) : !data || data.milestones.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <p className="text-4xl">🎯</p>
          <p className="font-semibold">{t("noMilestones")}</p>
          <p className="text-sm text-muted-foreground">{t("noMilestonesHint")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {data.milestones.map((m) => (
            <MilestonePreviewCard
              key={m.id}
              m={m}
              onShare={(milestone) => setSelected(milestone)}
            />
          ))}
        </div>
      )}

      {/* Share overlay */}
      {selected && data && (
        <ShareOverlay
          milestone={selected}
          cardData={buildCardData(selected)}
          shareText={selected.share_text}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
