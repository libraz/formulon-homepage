<script setup lang="ts">
/**
 * Draws one laid-out diagram scene: group panels, boxes with their sequence
 * number, wrapped name and note lines, row captions, and the connectors.
 *
 * The component takes finished geometry — flowLayout.ts and layersLayout.ts
 * own the maths — so both diagram types share the figure vocabulary from
 * styles/figures.css: `.fx-grp` panel, `.fx-card` / `.fx-alt` box, `.fx-hb`
 * name, `.fx-s` note, `.fx-lbl` caption and number, `.fx-ln` / `.fx-ah`
 * connector. Type sizes come from those classes; the matching constants in
 * diagramGeometry.ts exist so boxes can be sized before the text is laid out.
 */
import { computed } from 'vue'
import {
  CAPTION_SIZE,
  type DiagramScene,
  INDEX_BAND,
  LABEL_LEADING,
  LABEL_SIZE,
  NOTE_GAP,
  NOTE_LEADING,
  NOTE_SIZE
} from './diagramGeometry'

const props = defineProps<{
  scene: DiagramScene
  /** Instance-unique marker id; duplicate ids cross-wire between diagrams. */
  markerId: string
}>()

/** Boxes with their text baselines resolved, vertically centred in the box. */
const boxes = computed(() =>
  props.scene.boxes.map((box) => {
    const band = box.index ? INDEX_BAND : 0
    const top = box.y + band + (box.h - band - box.contentH) / 2
    const noteTop = top + box.labelLines.length * LABEL_LEADING + NOTE_GAP
    return {
      box,
      cx: box.x + box.w / 2,
      indexY: box.y + 6 + CAPTION_SIZE * 0.8,
      labels: box.labelLines.map((text, i) => ({
        text,
        y: top + i * LABEL_LEADING + LABEL_LEADING / 2 + LABEL_SIZE * 0.35
      })),
      notes: box.noteLines.map((text, i) => ({
        text,
        y: noteTop + i * NOTE_LEADING + NOTE_LEADING / 2 + NOTE_SIZE * 0.35
      }))
    }
  })
)
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
      <path class="fx-ah" d="M 0 0 L 7 3.5 L 0 7 Z" />
    </marker>
  </defs>

  <rect
    v-for="(lane, i) in props.scene.lanes"
    :key="`lane-${i}`"
    class="fx-grp"
    :x="lane.x"
    :y="lane.y"
    :width="lane.w"
    :height="lane.h"
    rx="7"
  />

  <text
    v-for="(caption, i) in props.scene.captions"
    :key="`cap-${i}`"
    class="fx-lbl"
    :x="caption.x"
    :y="caption.y"
  >
    {{ caption.text }}
  </text>

  <g v-for="(entry, i) in boxes" :key="`box-${i}`">
    <rect
      :class="entry.box.tone === 'alt' ? 'fx-alt' : 'fx-card'"
      :x="entry.box.x"
      :y="entry.box.y"
      :width="entry.box.w"
      :height="entry.box.h"
      rx="4"
    />
    <text v-if="entry.box.index" class="fx-lbl" :x="entry.box.x + 7" :y="entry.indexY">
      {{ entry.box.index }}
    </text>
    <text
      v-for="(line, j) in entry.labels"
      :key="`bl-${j}`"
      class="fx-hb"
      :x="entry.cx"
      :y="line.y"
      text-anchor="middle"
    >
      {{ line.text }}
    </text>
    <text
      v-for="(line, j) in entry.notes"
      :key="`bn-${j}`"
      class="fx-s"
      :x="entry.cx"
      :y="line.y"
      text-anchor="middle"
    >
      {{ line.text }}
    </text>
  </g>

  <path
    v-for="(d, i) in props.scene.arrows"
    :key="`arrow-${i}`"
    class="fx-ln"
    :d="d"
    :marker-end="`url(#${props.markerId})`"
  />
</template>
