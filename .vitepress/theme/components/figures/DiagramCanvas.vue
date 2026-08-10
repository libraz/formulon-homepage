<script setup lang="ts">
/**
 * Draws one laid-out diagram scene: lane backgrounds, boxes with their wrapped
 * label and note lines, row captions, and the connectors between them.
 *
 * The component takes finished geometry — DiagramFlow and DiagramLayers own all
 * the maths — so the two diagram types share one visual vocabulary: `.fx-lane`
 * for a grouping band, `.fx-block` for a box, `.fx-note--strong` for a label,
 * `.fx-tick` for a note, `.fx-axis-label` for a row caption, and a series-1
 * `.fx-curve` shaft with a solid `.fx-cell` head for every connector.
 *
 * Type sizes come from those classes; the matching constants in
 * diagramGeometry.ts only exist so the boxes can be sized before the browser
 * lays the text out.
 */
import { computed } from 'vue'
import {
  type DiagramScene,
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
    const top = box.y + (box.h - box.contentH) / 2
    const cx = box.x + box.w / 2
    const noteTop = top + box.labelLines.length * LABEL_LEADING + NOTE_GAP
    return {
      box,
      cx,
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
      <path class="fx-cell" d="M 0 0 L 7 3.5 L 0 7 Z" />
    </marker>
  </defs>

  <rect
    v-for="(lane, i) in props.scene.lanes"
    :key="`lane-${i}`"
    class="fx-lane"
    :x="lane.x"
    :y="lane.y"
    :width="lane.w"
    :height="lane.h"
    rx="5"
  />

  <text
    v-for="(caption, i) in props.scene.captions"
    :key="`cap-${i}`"
    class="fx-axis-label"
    :x="caption.x"
    :y="caption.y"
  >
    {{ caption.text }}
  </text>

  <g v-for="(entry, i) in boxes" :key="`box-${i}`">
    <rect
      class="fx-block"
      :x="entry.box.x"
      :y="entry.box.y"
      :width="entry.box.w"
      :height="entry.box.h"
      rx="4"
    />
    <text
      v-for="(line, j) in entry.labels"
      :key="`bl-${j}`"
      class="fx-note fx-note--strong"
      :x="entry.cx"
      :y="line.y"
      text-anchor="middle"
    >
      {{ line.text }}
    </text>
    <text
      v-for="(line, j) in entry.notes"
      :key="`bn-${j}`"
      class="fx-tick"
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
    class="fx-curve fx-curve--thin"
    :d="d"
    :marker-end="`url(#${props.markerId})`"
  />
</template>
