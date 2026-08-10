<script setup lang="ts">
/**
 * Shared chrome for every doc figure: the framed surface, the mono uppercase
 * title, the SVG canvas, an optional series legend, and the caption.
 *
 * Figure components own geometry only — they pass a viewBox and draw into the
 * default slot with the `.fx-*` vocabulary from styles/figures.css. The frame
 * reuses the `.doc-diagram-*` classes so every figure on a page shares one
 * panel treatment.
 *
 * A diagram whose wide layout cannot survive a phone-width column supplies a
 * second, narrow layout through `altViewBox` / `altWidth` and the `alt` slot.
 * SVG has no reflow of its own, so both layouts are computed and a media query
 * picks one. Both carry `role="img"` and the same label: `display: none`
 * removes the inactive copy from the accessibility tree, so the diagram is
 * announced exactly once at any viewport width.
 */
export interface FigureLegendItem {
  /** Series index 1-5, matching the --fx-N palette; 0 is the neutral rule colour. */
  series?: 0 | 1 | 2 | 3 | 4 | 5
  /** Swatch form: a line (default), a filled block, or a dashed guide. */
  shape?: 'line' | 'block' | 'dashed'
  label: string
}

const props = withDefaults(
  defineProps<{
    title?: string
    caption?: string
    /** Coordinate space the slot content is drawn in. */
    viewBox: string
    /** Intrinsic width in px; the SVG fills its column up to this. */
    width: number
    legend?: FigureLegendItem[]
    /** Screen-reader description of what the figure shows. */
    ariaLabel?: string
    /** Coordinate space of the narrow-viewport layout, if there is one. */
    altViewBox?: string
    altWidth?: number
  }>(),
  {
    title: undefined,
    caption: undefined,
    legend: () => [],
    ariaLabel: undefined,
    altViewBox: undefined,
    altWidth: undefined
  }
)
</script>

<template>
  <figure class="doc-diagram-wrap">
    <figcaption v-if="props.title" class="doc-diagram-head">{{ props.title }}</figcaption>
    <svg
      class="doc-diagram-svg doc-figure-main"
      :class="{ 'doc-figure-has-alt': props.altViewBox }"
      :viewBox="props.viewBox"
      :style="{ maxWidth: `${props.width}px` }"
      role="img"
      :aria-label="props.ariaLabel ?? props.title ?? 'Diagram'"
      xmlns="http://www.w3.org/2000/svg"
    >
      <slot />
    </svg>
    <svg
      v-if="props.altViewBox"
      class="doc-diagram-svg doc-figure-alt"
      :viewBox="props.altViewBox"
      :style="{ maxWidth: `${props.altWidth ?? props.width}px` }"
      role="img"
      :aria-label="props.ariaLabel ?? props.title ?? 'Diagram'"
      xmlns="http://www.w3.org/2000/svg"
    >
      <slot name="alt" />
    </svg>
    <ul v-if="props.legend.length > 0" class="fx-legend">
      <li v-for="(item, i) in props.legend" :key="`lg-${i}`">
        <span
          class="fx-legend-swatch"
          :data-series="item.series ?? 1"
          :data-shape="item.shape ?? 'line'"
        />
        <span>{{ item.label }}</span>
      </li>
    </ul>
    <div v-if="props.caption" class="doc-diagram-caption">{{ props.caption }}</div>
  </figure>
</template>

<style scoped>
/* Selectors are qualified with .doc-diagram-wrap so they outrank the
   `.doc-diagram-wrap .doc-diagram-svg { display: block }` rule in docs.css
   regardless of stylesheet order. */
.doc-diagram-wrap .doc-figure-alt {
  display: none;
}

@media (max-width: 640px) {
  .doc-diagram-wrap .doc-figure-main.doc-figure-has-alt {
    display: none;
  }

  .doc-diagram-wrap .doc-figure-alt {
    display: block;
  }
}
</style>
