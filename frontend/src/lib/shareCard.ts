export type MilestoneType = "weight_loss" | "weight_gain" | "body_fat" | "workout" | "streak" | "goal"

export interface ShareCardData {
  type: MilestoneType
  metric: string
  title: string
  subtitle: string
  displayName: string
}

interface Theme {
  from: string
  mid: string
  to: string
  emoji: string
  cssGradient: string
}

export const CARD_THEMES: Record<MilestoneType, Theme> = {
  weight_loss: {
    from: "#1e40af",
    mid: "#0891b2",
    to: "#0d9488",
    emoji: "⚖️",
    cssGradient: "linear-gradient(135deg, #1e40af 0%, #0891b2 50%, #0d9488 100%)",
  },
  weight_gain: {
    from: "#166534",
    mid: "#0d9488",
    to: "#0891b2",
    emoji: "💪",
    cssGradient: "linear-gradient(135deg, #166534 0%, #0d9488 50%, #0891b2 100%)",
  },
  body_fat: {
    from: "#0c4a6e",
    mid: "#1d4ed8",
    to: "#7c3aed",
    emoji: "📉",
    cssGradient: "linear-gradient(135deg, #0c4a6e 0%, #1d4ed8 55%, #7c3aed 100%)",
  },
  workout: {
    from: "#7f1d1d",
    mid: "#c2410c",
    to: "#b45309",
    emoji: "🏋️",
    cssGradient: "linear-gradient(135deg, #7f1d1d 0%, #c2410c 50%, #b45309 100%)",
  },
  streak: {
    from: "#9a3412",
    mid: "#c2410c",
    to: "#dc2626",
    emoji: "🔥",
    cssGradient: "linear-gradient(135deg, #9a3412 0%, #c2410c 50%, #dc2626 100%)",
  },
  goal: {
    from: "#4c1d95",
    mid: "#6d28d9",
    to: "#4f46e5",
    emoji: "🏆",
    cssGradient: "linear-gradient(135deg, #4c1d95 0%, #6d28d9 50%, #4f46e5 100%)",
  },
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

export function drawShareCard(canvas: HTMLCanvasElement, card: ShareCardData) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return

  const W = 1080
  const H = 1080
  canvas.width = W
  canvas.height = H

  const theme = CARD_THEMES[card.type]

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, theme.from)
  bg.addColorStop(0.55, theme.mid)
  bg.addColorStop(1, theme.to)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Decorative circles
  ctx.save()
  ctx.globalAlpha = 0.09
  ctx.fillStyle = "#ffffff"
  ctx.beginPath()
  ctx.arc(930, 170, 330, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(150, 910, 270, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Glass card panel
  ctx.save()
  ctx.globalAlpha = 0.13
  ctx.fillStyle = "#ffffff"
  roundRect(ctx, 64, 64, W - 128, H - 128, 52)
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.globalAlpha = 0.22
  ctx.strokeStyle = "#ffffff"
  ctx.lineWidth = 2
  roundRect(ctx, 65, 65, W - 130, H - 130, 51)
  ctx.stroke()
  ctx.restore()

  const font = `"Helvetica Neue", -apple-system, system-ui, sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"

  // Emoji
  ctx.font = `170px serif`
  ctx.fillText(theme.emoji, W / 2, 275)

  // Main metric
  ctx.font = `bold 155px ${font}`
  ctx.fillStyle = "#ffffff"
  ctx.shadowColor = "rgba(0,0,0,0.35)"
  ctx.shadowBlur = 24
  ctx.fillText(card.metric, W / 2, 490)
  ctx.shadowBlur = 0

  // Title
  ctx.font = `bold 70px ${font}`
  ctx.fillStyle = "rgba(255,255,255,0.93)"
  ctx.fillText(card.title, W / 2, 622)

  // Subtitle
  ctx.font = `44px ${font}`
  ctx.fillStyle = "rgba(255,255,255,0.68)"
  ctx.fillText(card.subtitle, W / 2, 710)

  // Divider
  ctx.save()
  ctx.globalAlpha = 0.28
  ctx.strokeStyle = "#ffffff"
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(196, 810)
  ctx.lineTo(W - 196, 810)
  ctx.stroke()
  ctx.restore()

  // Branding
  ctx.font = `bold 38px ${font}`
  ctx.fillStyle = "rgba(255,255,255,0.83)"
  ctx.fillText("Build Your Target Body", W / 2, 886)

  // Name + date
  const now = new Date()
  const dateStr = now.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  const nameStr = card.displayName ? `${card.displayName}  •  ${dateStr}` : dateStr
  ctx.font = `34px ${font}`
  ctx.fillStyle = "rgba(255,255,255,0.52)"
  ctx.fillText(nameStr, W / 2, 950)
}

export async function downloadCard(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return resolve()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        URL.revokeObjectURL(url)
        document.body.removeChild(a)
        resolve()
      }, 120)
    }, "image/png")
  })
}

export async function nativeShare(canvas: HTMLCanvasElement, text: string): Promise<boolean> {
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return resolve(false)
      const file = new File([blob], "progress.png", { type: "image/png" })
      try {
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: "My Progress", text })
          return resolve(true)
        }
      } catch {
        // user cancelled or browser error
      }
      resolve(false)
    }, "image/png")
  })
}
