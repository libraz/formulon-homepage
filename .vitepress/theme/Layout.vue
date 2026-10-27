<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import HomeCellDemo from './components/HomeCellDemo.vue'
import HomeHero from './components/HomeHero.vue'
import HomeMcp from './components/HomeMcp.vue'
import HomeSpec from './components/HomeSpec.vue'
import HomeStack from './components/HomeStack.vue'
import HomeWhy from './components/HomeWhy.vue'

const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #home-hero-before>
      <HomeHero />
    </template>
    <template #home-features-before>
      <HomeSpec />
      <HomeWhy />
      <HomeCellDemo />
      <HomeMcp />
      <HomeStack />
    </template>
  </Layout>
</template>
