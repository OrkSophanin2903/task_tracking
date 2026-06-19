// Register only the Chart.js pieces the dashboard uses (tree-shaken).
// Client-only plugin so Chart.js (which needs a canvas/DOM) never runs on the server.
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  LinearScale,
  Tooltip,
} from 'chart.js'

export default defineNuxtPlugin(() => {
  Chart.register(
    DoughnutController,
    ArcElement,
    BarController,
    BarElement,
    CategoryScale,
    LinearScale,
    Tooltip,
  )
})
