# Changelog

## 1.0.0

First public release.

- Composer-side balance card with balance, previous-turn spend, and current-turn spend.
- Running and interrupted states with animated status dots and persistence across DSH restarts.
- Cache hit rate bar and context usage ring with blue/orange/red thresholds.
- Three independent switches: balance card, usage trajectory, and other information.
- Native composer statistics row behavior follows the switches.
- Compact mode shrinks the card and composer to 80%, including the input height.
- Per-turn usage trajectory with tokens, cache hit rate, cost, duration, peak window, and model version.
- Bilingual Chinese/English UI, locale metadata, README, and install guide.
- No model requests, no appended messages, no extra token charges.
