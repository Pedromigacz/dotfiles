# Slice 05 — Live streaming & cancellation

## Parent

[PRD — Tool Tester TUI](./PRD.md)

## What to build

Make long-running tools observable and interruptible. The tool-runner already threads
an update callback and an abort signal into `execute`; this slice wires them to the UI
and the keyboard.

- **Live streaming:** partial results emitted via the update callback re-render the
  result view as they arrive, so progress from tools like `web_fetch` or `bash` is
  visible while the tool runs.
- **Cancellation:** while a run is in flight, Ctrl-C aborts it via the abort signal.
- **Navigation guard:** Escape only navigates back to the form when no run is in
  flight, so cancel and back-out are unambiguous.

## Acceptance criteria

- [ ] A streaming tool's partial output appears in the result view live, before the
      run completes.
- [ ] Pressing Ctrl-C during a run requests abort via the tool's abort signal and
      returns the UI to a ready state.
- [ ] Escape navigates back only when no run is in progress; during a run it does not
      double as cancel.
- [ ] A tool that ignores its abort signal still leaves the app responsive after the
      run eventually completes.

## Blocked by

- Blocked by #01 (walking skeleton). Best sequenced after #04 (rich result rendering),
  which it re-renders into.
