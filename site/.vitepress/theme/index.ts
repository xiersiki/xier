import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import XierHome from './XierHome.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('XierHome', XierHome)
  },
} satisfies Theme
