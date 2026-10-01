import { ref } from 'vue'

export const lang = ref('en')
export const isDark = ref(false)

export function useData() {
  return { lang, isDark }
}
