# Changelog

## 1.9.0

- Remove the in-app “View example data” toggle and all synthetic demo rows from the shipped plugin.
- Collect every Session’s complete turn projection on first enable, on plugin reload, and whenever the balance card or usage trajectory is turned on again.
- Normalize every Session projection and the workspace merge by turn number, so repeated refreshes or toggles cannot append a duplicate row.
- Deduplicate workspace Session IDs before merging and keep the latest/most complete record for a repeated turn.
- Re-run a full collection when the trajectory view opens with an empty cache.

## 1.8.5

- Increase the font sizes of the model usage split and the official price table.
- Third-party turn rows now show a yellow “Flat price”/“统一价” window label instead of a fake peak/off-peak label.
- Third-party billing lines now say just “统一价” instead of “高峰=空闲（无峰谷）”.

## 1.8.4

- Add a dated third-party billing catalog for common OpenAI, Anthropic, and Google models, shown under each third-party row with input/cache/output reference prices and peak/off-peak (or flat) rules.
- Use larger synthetic volumes in the in-app example and show 万/亿 Chinese units for usage below 10,000 as well.
- Example data is reachable from the “View example data” button inside the usage trajectory, not only from an external screenshot.

## 1.8.3

- Add an in-app “View example data” toggle to the usage trajectory so local/third-party demo rows can be previewed inside DSH.
- Use larger synthetic token volumes in the example so Chinese 万/亿 units are visible.

## 1.8.2

- Display provider names in their canonical form (OpenAI, LM Studio, Anthropic, Google, etc.) in model rows and cards.

## 1.8.1

- Show each local and third-party model with both current-window and workspace totals in the model split.
- Hide the entire model split and rules when no local or third-party model has been used.
- Rename the paid-model summaries to “Workspace · paid models” and “Current window · paid models”.

## 1.8.0

- Add a Model usage split below the current-window summary: local models get per-model rows with tokens/turns and zero charge; other paid APIs get per-provider/model rows with tokens/turns and cost when available.
- Add detailed statistics rules inside the view: official DeepSeek and other paid APIs count toward workspace/current totals; local models are separate and free.
- The selected local/third-party route no longer takes the Flash/Pro Current badge; external routes show their own row below the price legend.
- Include third-party paid tokens in workspace/current totals; local tokens remain excluded. Third-party cost is included only when the turn carries a cost value.

## 1.7.0

- Treat non-DeepSeek/local routes as zero-cost: they never use Flash/Pro prices, never add to token/cost totals, never affect the average cache rate, and never create a wallet charge.
- Show local turns as a separate “Local N · free” chip; mark local table rows and use a local-model card state with “No balance charge”.
- Detect the active route from `modelSelection` so the card and price table adapt immediately when switching to a local model.
- Keep local per-turn token counts visible in the row for transparency, but exclude them from aggregate consumption and wallet totals.

## 1.6.0

- Remove the crescent-like left accent border; use solid pale blue/violet card backgrounds instead of gradients, with no cyan.
- Track the selected model through the `modelSelection` projection so the “当前” badge moves before the next turn; add a local-model row below the price legends when the selected provider is local.
- Keep the card’s current-turn spend right-aligned, center the peak/off-peak state between the two price lines, space the spend row away from the window row, and add token units to both prices.
- Exclude blank new Sessions from the workspace window count.

## 1.5.0

- Remove the extra card details (turns, steps, speed, tokens, cache, context); keep the official composer statistics row visible.
- Color peak hours red and off-peak teal; use the same font size as the current-turn cost and add the token unit to both prices.
- Align the price legend under each price column and repeat it under peak and off-peak.
- Exclude blank “new Session” rows from the workspace window count.
- Replace the summary-card gradients with solid backgrounds plus accent borders and badges.
- Restore the card/composer height to 108px now that the card no longer carries statistics.

## 1.4.3

- Stack the balance and previous/current costs on separate lines in the narrower card, and raise the shared composer/card height to 120px so nothing overlaps or clips.
- Derive the displayed official price version from the current turn's model id, with the pricing date kept in `PRICING_DATE`.

## 1.4.2

- Fit the full balance card, including the live window/price row, into the 224px width without horizontal overlap.

## 1.4.1

- Tighten the balance-card typography and spacing so the full card, including the new live window/price row, fits the 224px width without clipping.

## 1.4.0

- Show both Flash and Pro peak/off-peak official prices in a compact grid with a configurable official pricing version.
- Use “每 百万 Token” instead of `/1M` for Chinese users.
- Remove the “Show other information” switch and the compact card mode; the card always shows full details.
- Add a live peak/off-peak state and current input/output price below the balance, refreshed every 15 seconds.
- Shrink the balance card width by about one fifth (224px on wide composers).
- Keep the native composer statistics row hidden while the card is mounted and restore it when the card is off.

## 1.3.0

- Color the workspace and current-window summary cards blue/cyan with scope badges and accent borders so they are distinguishable at a glance.
- Move the page title and both summary cards into the scroll area; they now scroll away with the turn history.
- Keep the peak/off-peak price row and the turn table header sticky at the top while scrolling.
- Add official per-1M-token peak and off-peak prices (cache/input/output) below the current-window card, using the same price table as cost estimation.
- Keep all price numbers blue.

## 1.2.0

- Split the workspace summary and the current-window summary into two separate cards.
- Move the workspace card to the top of the Usage trajectory view; put the current-window card directly below it.
- Include the current window's total turns, total tokens, total estimated cost, and average cache hit rate in its own card.
- Run a full projection collection on first enable and again whenever Usage trajectory is re-enabled.
- Refresh the other Sessions in the current workspace when the view opens, switches workspace, or finishes a turn, so the workspace totals stay current.

## 1.1.0

- Add a workspace summary to the top of the Usage trajectory view: total tokens, estimated cost, and turns for every conversation in the current Session's workspace.
- Add the current Session's weighted average cache hit rate below the workspace summary.
- Fix cache hit/miss percentages to use input tokens instead of total tokens, so they sum to 100%.
- Align the blue cache hit rate with the cache-hit percentage; both now use the same input-token denominator.
- Update the bilingual README and install notes for the new workspace summary.

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
