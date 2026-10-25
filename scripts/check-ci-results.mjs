// CI_NEEDS is GitHub's toJSON(needs), passed as data rather than shell source.
try {
  const needs = JSON.parse(process.env.CI_NEEDS || 'null');
  for (const job of ['scope', 'spec']) {
    if (needs?.[job]?.result !== 'success') throw new Error(`${job} must succeed`);
  }
  for (const job of ['app', 'site', 'desktop']) {
    const selected = needs.scope.outputs?.[job];
    const result = needs[job]?.result;
    if (selected !== 'true' && selected !== 'false') throw new Error(`${job}: invalid scope output`);
    if (result !== 'success' && !(selected === 'false' && result === 'skipped')) {
      throw new Error(`${job}: selected=${selected}, result=${result ?? 'missing'}`);
    }
  }
  console.log('Required checks passed; only explicitly unneeded jobs may be skipped.');
} catch (error) {
  console.error(`CI results rejected: ${error.message}`);
  process.exitCode = 1;
}
