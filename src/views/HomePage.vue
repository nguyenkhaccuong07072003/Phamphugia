<script setup lang="ts">
import ImageSlider from '../components/ImageSlider.vue'
import NewsHighlight from '../components/NewsHighlight.vue'
import NewsGrid from '../components/NewsGrid.vue'
</script>

<template>
  <div class="w-full py-10 px-10 max-sm:px-3 max-sm:py-4">
    <!-- Slider + News highlight row -->
    <div class="flex gap-4 max-lg:flex-col max-sm:gap-3">
      <div class="w-[55%] shrink-0 min-w-0 max-lg:w-full">
        <ImageSlider />
      </div>
      <div class="flex-1 min-w-0 max-lg:w-full max-sm:w-full" style="margin-right: 7px">
        <NewsHighlight />
      </div>
    </div>

    <!-- News grid 5x5 -->
    <NewsGrid />
  </div>
</template>
