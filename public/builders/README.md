# Builder avatars

Drop the two builder portrait images here, using **exactly** these filenames:

| Builder | Role | File to add |
|---|---|---|
| BUILDER_01 | Director | `builder_01.png` **or** `builder_01.jpg` |
| BUILDER_02 | Programmer | `builder_02.png` **or** `builder_02.jpg` |

## Guidelines

- **Square** images (e.g. 512 × 512). They are rendered in small square frames.
- **Either `.png` or `.jpg` works** — the code tries `.png` first and
  automatically falls back to `.jpg`. Just keep the base name `builder_01` /
  `builder_02`.
- Centered face / head-and-shoulders works best — the frame is small.
- If a file is missing, the UI falls back to the builder's ID text, so nothing breaks.

These avatars appear:
1. On the **projection wall** — the gold foundation anchors in the Graveyard panel.
2. In the **backdoor fusion ceremony** — the foundation row at the bottom.
