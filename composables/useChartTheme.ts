import { nextTick, onMounted, ref, watch } from 'vue'

/**
 * Colours for the dashboard charts, read from the live CSS design tokens so
 * Chart.js matches the "Graphite & Signal" palette and re-themes on light/dark
 * toggle. Reads happen on the client only (charts render inside <ClientOnly>).
 */
export interface ChartPalette {
  status: { todo: string; in_progress: string; done: string }
  priority: { high: string; medium: string; low: string }
  text: string
  textFaint: string
  grid: string
  surface: string
  fallback: string
}

function readPalette(): ChartPalette {
  const s = getComputedStyle(document.documentElement)
  const v = (name: string) => s.getPropertyValue(name).trim()
  return {
    status: {
      todo: v('--status-todo'),
      in_progress: v('--status-in_progress'),
      done: v('--status-done'),
    },
    priority: {
      high: v('--prio-high-fg'),
      medium: v('--prio-medium-fg'),
      low: v('--prio-low-fg'),
    },
    text: v('--text-muted'),
    textFaint: v('--text-faint'),
    grid: v('--border'),
    surface: v('--surface'),
    fallback: v('--accent'),
  }
}

export function useChartTheme() {
  const colorMode = useColorMode()
  const palette = ref<ChartPalette | null>(null)

  onMounted(() => {
    palette.value = readPalette()
  })

  // Re-read tokens after the .light/.dark class flips on <html>.
  watch(
    () => colorMode.value,
    () => nextTick(() => (palette.value = readPalette())),
  )

  return { palette }
}
