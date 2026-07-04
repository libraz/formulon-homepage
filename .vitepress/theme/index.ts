import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import CellFullDemo from './components/CellFullDemo.vue'
import DiagramFlow from './components/DiagramFlow.vue'
import DiagramLayers from './components/DiagramLayers.vue'
import SvgEmail from './components/SvgEmail.vue'
import Layout from './Layout.vue'
import '@libraz/formulon-cell/styles.css'
import '@libraz/formulon-cell/styles/paper.css'
import '@libraz/formulon-cell/styles/ink.css'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('CellFullDemo', CellFullDemo)
    app.component('SvgEmail', SvgEmail)
    app.component('DiagramFlow', DiagramFlow)
    app.component('DiagramLayers', DiagramLayers)
  }
} satisfies Theme
