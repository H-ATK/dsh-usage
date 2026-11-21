# Changelog

## 1.15.7

- Refresh the published package at a new patch version; no functional changes.

## 1.15.6

- Publish the latest bilingual UI, three-feature documentation, screenshots, and archive changes under a new patch version.

## 1.15.5

- Declare `engines.dsh` (`>=0.2.2-rc.3`, the running Host runtime) and `dsh.manifestVersion` for marketplace publishing.
- Rename the public plugin display name to 使用量统计 / Usage statistics and refresh the README screenshots.

## 1.15.4

- Freeze the Excel header row and widen the Token/input/cache/output columns.

## 1.15.3

- Widen time, token, input, cache, output, and provider columns in the Excel export.
- Increase Excel row height/font size, align every cell left, and show model version labels.
- Append compact Chinese units to non-zero token metrics while leaving cost untouched.

## 1.15.2

- Localize CSV headers for Chinese users while keeping the token column label as `Token`.
- Add an Excel (SpreadsheetML) export with preset column widths for WPS/Excel.

## 1.15.1

- Anchor the balance card to the composer seat explicitly, fixing its vertical position on the new-conversation layout.

## 1.15.0

- Persist the usage archive in the Host profile (`storages/dsh-usage-balance/archive.json`) instead of relying only on browser storage.
- Merge deleted-Session history back into the browser collection on startup, with local-storage migration and fallback.

## 1.14.2

- Remove the redundant “价格表” footer text from the price-table window.

## 1.14.1

- Remove the report-window footer close buttons; use the native title-bar close button.
- Switch report-window colors from captured DSH tokens to a neutral OS light/dark palette with live `prefers-color-scheme` updates.

## 1.14.0

- Shorten the usage-detail window to a 520px request and enlarge detail, model, and price-table text/icons.
- Remove category-only model chips; only real model names are shown.
- Adapt report-window content colors to Windows light/dark mode and allow fallback modal resizing.

## 1.13.9

- Adapt report-window colors to the Windows light/dark color scheme.
- Lower the usage-detail window height and allow mouse resizing of the fallback modal panels.

## 1.13.8

- Remove the diagnostic child-window shortcut and keep the modal fallback when the desktop child-window policy refuses the report window.

## 1.13.7

- Fix a malformed client constant that prevented the plugin tabs from loading.

## 1.13.6

- Use DSH's own desktop child-window policy for report windows, so the new window belongs to DSH and groups with the app in the Windows taskbar.

## 1.13.5

- Make `webServer` an explicit Host dependency so the native-window and pricing routes are registered reliably after startup.

## 1.13.4

- Open usage details and the price table as native Windows app windows through a Host Edge/Chrome launcher, with modal fallback.
- Add a separate pricing edit button in the overview toolbar.
- Replace the remaining category dots in the in-page detail fallback with vendor icons.

## 1.13.3

- Replace the remaining category dots in the click detail view with vendor icons.
- Open chart details and the price table in dedicated resizable windows, with modal fallback when pop-ups are blocked.

## 1.13.2

- Replace trend legend/tooltip dots with vendor icons instead of adding a separate model row.
- Add a DeepSeek official CNY price table and explicit per-million-token units.
- Expand the remote pricing catalog to 20 mainstream OpenAI, Anthropic, Google, and xAI models.
- Ignore remote pricing catalogs older than the bundled version.

## 1.13.1

- Show vendor icons in the chart hover tooltip and the click-to-inspect modal.
- Replace the stretched “all models” mark with a balanced grid icon and preserve SVG aspect ratio.
- Explain that the pricing table only lists third-party models with a reference price.

## 1.13.0

- Add inline SVG vendor marks before model names across the trajectory, overview, pricing table, and model filter.
- Replace the native model select with an icon-capable listbox, including a local-model mark.

## 1.12.9

- Remove the rounded accent on the workspace/model context bar.
- Enlarge the four summary labels further.
- Show pricing read-only as a clean table; JSON editing is a separate Edit mode, with Edit to the right of Reset.
- Fix the invisible action button text and add a CSV format hint.

## 1.12.8

- Promote the workspace/model filters into a highlighted context bar with fixed widths.
- Enlarge the four overview summary labels.

## 1.12.7

- Highlight the overview filter labels, selected filter values, and summary labels in the primary text color.

## 1.12.6

- Count the four overview summary figures up from zero when they enter view.
- Switch trajectory progress bars to transform-based fills to remove layout jank, and shorten reveal timings.

## 1.12.5

- Give every trajectory progress bar its own viewport observer so late-expanded rows animate reliably.

## 1.12.4

- Keep trajectory rows fully visible while revealing only their progress bars and overview surfaces.
- Observe DOM additions so late-arriving rows and range-switched charts still get their scroll reveal.

## 1.12.3

- Reveal usage-trajectory cache bars and overview chart/composition bars only when they approach the viewport.
- Add scroll-reveal fades to overview cards/chart/model sections and trajectory rows.
- Smooth hover/transition polish for overview cards, model rows, and range controls.

## 1.12.2

- Reject a pricing import that omits the `models` array instead of treating it as a reset.

## 1.12.1

- Add the 2026 Chinese statutory-holiday and make-up-workday calendar to peak/off-peak pricing.
- Debounce archive writes and flush them when the plugin is disposed.

## 1.12.0

- Persist collected turns in a browser-side archive so deleted Sessions still count toward all-time totals.
- Raise the Host projection from 500 to 100,000 turns and merge archived turns with live projections.
- Add 7/30/90-day, custom date, workspace, and model filters.
- Add filtered CSV export.
- Add an editable local pricing override, imported as JSON, which takes precedence over remote catalogs.

## 1.11.1

- Stop showing a synthetic “unknown model” row for historical turns with no recorded model metadata.
- Do not classify a turn with no provider and no model as third-party; such unrecorded legacy turns now fall back to the official bucket.

## 1.11.0

- Add a Token composition section with input, cache read, cache write, and output totals plus cache-hit rate and average tokens per turn.
- Add a model details table with per-model tokens, share, cost, turns, type, and provider.
- Keep both sections reactive to the selected range and live collection updates.

## 1.10.2

- Stop creating a synthetic “ungrouped” workspace card for historical sessions whose workspace is no longer present in the current sidebar snapshot.

## 1.10.1

- Fix the blank Usage overview page by receiving the Session and Workspace hooks from the conversation view props.

## 1.10.0

- Move workspace statistics out of the usage trajectory and into a workspace section on the Usage overview page.
- Show one live card per workspace with its current name, session count, tokens, DeepSeek spend, third-party spend, turns, and local usage.
- Keep workspace names and counts reactive to renames, additions, removals, and range changes.

## 1.9.9

- Hide the local-model amount from the modal cost strip; local usage remains in the ring and legend but is never billed.

## 1.9.8

- Respect reduced-motion settings for the new card, modal, and ring animations.

## 1.9.7

- Fade the balance card in and out instead of popping on feature changes.
- Make the modal ring a single thick segmented ring with straight radial boundaries and a 0–100% reveal animation.
- Put each type's token count before a right-aligned percentage, and add per-type spend below the ring and legend.

## 1.9.6

- Replace the three separate modal rings with one segmented circular ring whose arcs are proportional to official, third-party, and local usage.
- Increase the modal, legend, chart, summary, tooltip, axis, and footnote font sizes across the Usage overview page.
- Show each type's percentage and token amount beside the single ring.

## 1.9.5

- Make chart hover tracking imperative/60fps so the tooltip and column highlight follow the pointer without React re-render stutter.
- Open a click-to-inspect modal from a chart column, with three circular usage rings for official, third-party, and local consumption.
- Close the modal when clicking its backdrop, its close button, or pressing Escape.

## 1.9.4

- Smoothly slide the chart hover highlight between columns and remove the dashed crosshair.
- Make the tooltip follow the pointer and update its position/content live.
- Split official, third-party, and local usage into three tooltip rows.
- Label every chart column that has usage with its date; empty dates stay unlabeled.

## 1.9.3

- Add a live hover crosshair and tooltip to the overview token chart.
- Animate the token bars upward whenever the overview opens or its range changes.
- Scale the chart ceiling dynamically with the actual usage, and color bars orange above 500M tokens and red above 1B tokens.
- Show the period date under the chart.

## 1.9.2

- Make the Usage overview page an absolute scroll surface inside the conversation view, with its own scrollbar gutter and composer-safe bottom padding.

## 1.9.1

- Add a standalone Usage overview page with today, this month, and all-time summaries plus a token trend chart.
- Make the overview page itself the scroll container so long content scrolls inside the conversation view.
- Add an independent Usage overview switch.

## 1.9.0

- Add workspace/current-window paid-model summaries and a per-model usage split for local models and third-party paid APIs.
- Local models are tracked separately: tokens and turns stay in the ledger, but they are excluded from paid totals and never charge the DeepSeek balance.
- Third-party paid API tokens count toward paid totals and are listed separately by provider/model. Costs are shown only when available; vendor bills remain authoritative.
- Add dated reference billing lines for OpenAI, Anthropic, and Google; third-party turn windows show "Flat price" in yellow because these vendors have no peak/off-peak split.
- Increase the model-split and official-price font sizes, use Chinese 万/亿 units, and show “per 1M tokens” in Chinese.
- Collect all Session turns when the plugin or either feature is first enabled/re-enabled.

## 1.0.0

- First public release: balance card with previous/current-turn spend and peak/off-peak pricing, plus the usage trajectory with per-turn token, cost, duration, cache, and status details.
