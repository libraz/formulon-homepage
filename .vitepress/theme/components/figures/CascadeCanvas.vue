<script setup lang="ts">
/**
 * Draws one laid-out precedence cascade: the container band, the competing
 * declarations stacked inside it, the value that wins, and the two
 * connectors.
 *
 * Geometry arrives finished from cascadeGeometry.ts, and presentation comes
 * from the same `.fx-*` vocabulary the other figures use — `.fx-lane` for the
 * container, `.fx-block` for a declaration, `.fx-block--muted` for the
 * resolved value, `.fx-axis-label` for a micro-label.
 */
import type { CascadeScene } from './cascadeGeometry'

const props = defineProps<{
  scene: CascadeScene
  /** Instance-unique marker id; duplicate ids cross-wire between diagrams. */
  markerId: string
}>()
</script>

<template>
  <defs>
    <marker
      :id="props.markerId"
      markerWidth="8"
      markerHeight="7"
      refX="7"
      refY="3.5"
      orient="auto"
      markerUnits="userSpaceOnUse"
    >
      <path class="fx-cell" d="M 0 0 L 7 3.5 L 0 7 Z" />
    </marker>
  </defs>

  <rect
    class="fx-lane"
    :x="props.scene.lane.x"
    :y="props.scene.lane.y"
    :width="props.scene.lane.w"
    :height="props.scene.lane.h"
    rx="5"
  />

  <g v-for="(band, i) in props.scene.bands" :key="`band-${i}`">
    <rect class="fx-block" :x="band.x" :y="band.y" :width="band.w" :height="band.h" rx="4" />
    <text
      v-if="band.tag"
      class="fx-axis-label"
      :x="band.x + props.scene.padX"
      :y="band.tag.y"
    >
      {{ band.tag.text }}
    </text>
    <text
      v-for="(line, j) in band.labels"
      :key="`bl-${j}`"
      class="fx-note fx-note--strong"
      :x="band.x + props.scene.padX"
      :y="line.y"
    >
      {{ line.text }}
    </text>
    <text
      v-for="(line, j) in band.notes"
      :key="`bn-${j}`"
      class="fx-tick"
      :x="band.x + props.scene.padX"
      :y="line.y"
    >
      {{ line.text }}
    </text>
  </g>

  <g>
    <rect
      class="fx-block fx-block--muted"
      :x="props.scene.resolved.x"
      :y="props.scene.resolved.y"
      :width="props.scene.resolved.w"
      :height="props.scene.resolved.h"
      rx="4"
    />
    <text
      v-if="props.scene.resolved.tag"
      class="fx-axis-label"
      :x="props.scene.resolved.x + props.scene.padX"
      :y="props.scene.resolved.tag.y"
    >
      {{ props.scene.resolved.tag.text }}
    </text>
    <text
      v-for="(line, j) in props.scene.resolved.labels"
      :key="`rl-${j}`"
      class="fx-note fx-note--strong"
      :x="props.scene.resolved.x + props.scene.padX"
      :y="line.y"
    >
      {{ line.text }}
    </text>
    <text
      v-for="(line, j) in props.scene.resolved.notes"
      :key="`rn-${j}`"
      class="fx-tick"
      :x="props.scene.resolved.x + props.scene.padX"
      :y="line.y"
    >
      {{ line.text }}
    </text>
  </g>

  <path
    v-for="(d, i) in props.scene.arrows"
    :key="`arrow-${i}`"
    class="fx-curve fx-curve--thin"
    :d="d"
    :marker-end="`url(#${props.markerId})`"
  />
</template>
