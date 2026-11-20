# Changelog

## 1.9.0

- Add workspace/current-window paid-model summaries and a per-model usage split for local models and third-party paid APIs.
- Local models are tracked separately: tokens and turns stay in the ledger, but they are excluded from paid totals and never charge the DeepSeek balance.
- Third-party paid API tokens count toward paid totals and are listed separately by provider/model. Costs are shown only when available; vendor bills remain authoritative.
- Add dated reference billing lines for OpenAI, Anthropic, and Google; third-party turn windows show "Flat price" in yellow because these vendors have no peak/off-peak split.
- Increase the model-split and official-price font sizes, use Chinese 万/亿 units, and show “per 1M tokens” in Chinese.
- Collect all Session turns when the plugin or either feature is first enabled/re-enabled.

## 1.0.0

- First public release: balance card with previous/current-turn spend and peak/off-peak pricing, plus the usage trajectory with per-turn token, cost, duration, cache, and status details.
