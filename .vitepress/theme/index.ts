import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { defineAsyncComponent } from 'vue'
import CellFullDemo from './components/CellFullDemo.vue'
import DiagramFlow from './components/DiagramFlow.vue'
import DiagramLayers from './components/DiagramLayers.vue'
import SvgEmail from './components/SvgEmail.vue'
import Layout from './Layout.vue'
import '@libraz/formulon-cell/styles.css'
import './custom.css'

// The live-engine demos are code-split: a page that embeds none of them must
// not pay for their chunks, and the engine itself is fetched only once the
// reader activates a demo.
const FormulaEvalDemo = defineAsyncComponent(() => import('@/components/demos/FormulaEvalDemo.vue'))
const SpillDemo = defineAsyncComponent(() => import('@/components/demos/SpillDemo.vue'))
const TraceDemo = defineAsyncComponent(() => import('@/components/demos/TraceDemo.vue'))
const RecalcDemo = defineAsyncComponent(() => import('@/components/demos/RecalcDemo.vue'))
const FunctionLookupDemo = defineAsyncComponent(
  () => import('@/components/demos/FunctionLookupDemo.vue')
)
const IterativeDemo = defineAsyncComponent(() => import('@/components/demos/IterativeDemo.vue'))
const DemoFrame = defineAsyncComponent(() => import('@/components/demos/DemoFrame.vue'))

// Bespoke figures: one page each, so they are code-split like the demos.
const CellTokenCascade = defineAsyncComponent(
  () => import('./components/figures/CellTokenCascade.vue')
)

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('CellFullDemo', CellFullDemo)
    app.component('SvgEmail', SvgEmail)
    app.component('DiagramFlow', DiagramFlow)
    app.component('DiagramLayers', DiagramLayers)
    app.component('DemoFrame', DemoFrame)
    app.component('FormulaEvalDemo', FormulaEvalDemo)
    app.component('SpillDemo', SpillDemo)
    app.component('TraceDemo', TraceDemo)
    app.component('RecalcDemo', RecalcDemo)
    app.component('FunctionLookupDemo', FunctionLookupDemo)
    app.component('IterativeDemo', IterativeDemo)
    app.component('CellTokenCascade', CellTokenCascade)
  }
} satisfies Theme
