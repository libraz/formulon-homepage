<script setup lang="ts">
import { useData } from 'vitepress'
import { computed } from 'vue'

type ToolGroup = { label: string; value: string }

const { lang } = useData()
const isJa = computed(() => lang.value === 'ja')

const copy = computed(() =>
  isJa.value
    ? {
        section: 'Agent interface',
        heading: 'AI エージェントから workbook を直接扱う。',
        body: 'formulon-mcp は Formulon の計算 core を MCP tools として公開します。エージェントは .xlsx を開き、セルやシートを編集し、再計算して保存できます。',
        primary: { text: 'MCP セットアップ', link: '/ja/mcp/' },
        secondary: { text: 'GitHub', link: 'https://github.com/libraz/formulon-mcp' },
        installLabel: 'Codex config',
        install: [
          '[mcp_servers.formulon]',
          'command = "npx"',
          'args = ["-y", "@libraz/formulon-mcp"]'
        ],
        groups: [
          { label: 'Formula', value: 'eval, lookup, trace' },
          { label: 'Workbook', value: 'open, inspect, recalc, save' },
          { label: 'Edit', value: 'cells, sheets, names, ranges' },
          { label: 'Layout', value: 'merges, comments, validation' }
        ] as ToolGroup[]
      }
    : {
        section: 'Agent interface',
        heading: 'Let AI agents work inside real workbooks.',
        body: 'formulon-mcp exposes the Formulon calculation core as MCP tools. Agents can open .xlsx files, inspect structure, edit cells and sheets, recalculate, and save the result.',
        primary: { text: 'Set up MCP', link: '/mcp/' },
        secondary: { text: 'GitHub', link: 'https://github.com/libraz/formulon-mcp' },
        installLabel: 'Codex config',
        install: [
          '[mcp_servers.formulon]',
          'command = "npx"',
          'args = ["-y", "@libraz/formulon-mcp"]'
        ],
        groups: [
          { label: 'Formula', value: 'eval, lookup, trace' },
          { label: 'Workbook', value: 'open, inspect, recalc, save' },
          { label: 'Edit', value: 'cells, sheets, names, ranges' },
          { label: 'Layout', value: 'merges, comments, validation' }
        ] as ToolGroup[]
      }
)
</script>

<template>
  <section class="fln-mcp" aria-labelledby="fln-mcp-title">
    <div class="fln-mcp-inner">
      <div class="fln-mcp-copy">
        <span class="fln-section-mark" data-volume="01">{{ copy.section }}</span>
        <h2 id="fln-mcp-title">{{ copy.heading }}</h2>
        <p>{{ copy.body }}</p>
        <div class="fln-mcp-actions">
          <a :href="copy.primary.link" class="fln-cta fln-cta-primary"
            >{{ copy.primary.text }}<span aria-hidden="true">→</span></a
          >
          <a :href="copy.secondary.link" class="fln-cta-link">{{ copy.secondary.text }}</a>
        </div>
      </div>
      <div class="fln-mcp-panel">
        <div class="fln-mcp-terminal" aria-label="formulon-mcp setup snippet">
          <div class="fln-mcp-terminal-bar">
            <span>{{ copy.installLabel }}</span>
            <code>@libraz/formulon-mcp</code>
          </div>
          <pre><code><span v-for="line in copy.install" :key="line">{{ line }}
</span></code></pre>
        </div>
        <div class="fln-mcp-tools" role="list">
          <div v-for="group in copy.groups" :key="group.label" role="listitem">
            <span>{{ group.label }}</span>
            <strong>{{ group.value }}</strong>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
