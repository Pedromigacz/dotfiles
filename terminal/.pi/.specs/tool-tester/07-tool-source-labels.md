# Slice 07 — Tool source labels

## Parent

[PRD — Tool Tester TUI](./PRD.md)

## What to build

Label each tool in the list with its source (pi built-in vs. local extension) so that
when a built-in and an extension share a name (e.g. `read`, `bash`, `edit`), I can see
which one the session actually resolved and is about to run.

This enriches the harvested tool data with a source attribution and surfaces it in the
list step.

## Acceptance criteria

- [ ] Each tool in the list shows a source indicator (built-in vs. extension).
- [ ] When two tools share a name, the list makes the resolved/active one visible
      rather than silently hiding the collision.
- [ ] Source labeling does not affect which tool is executed — it only annotates the
      list.

## Blocked by

- Blocked by #01 (walking skeleton).
