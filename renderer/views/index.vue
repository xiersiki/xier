<template>
  <div class="main-view">
    <title-bar class="workspace-titlebar"><drag-region class="w-full" /></title-bar>
    <main><router-view /></main>
  </div>
</template>
<style scoped>
.main-view { height: 100%; display: flex; flex-direction: column; }
.workspace-titlebar { height: 36px; flex-shrink: 0; }
main { flex: 1; min-height: 0; }
</style>
