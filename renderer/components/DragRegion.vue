<template>
  <div class="drag-region">
    <slot>
      <span class="_placeholder" aria-hidden="true">_hidden</span>
    </slot>
  </div>
</template>

<style scoped>
._placeholder {
  opacity: 0;
}
</style>
