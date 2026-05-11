import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import CellFullDemo from './components/CellFullDemo.vue'
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
  }
} satisfies Theme
