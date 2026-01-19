### Summary

Add an export option that produces an LLM-friendly JSON view: normalized values, explicit roles, constraints emphasized.

### Motivation

If the plugin can emit a “clean spec”, LLMs will reproduce designs more reliably in Unity and other runtimes.

### Requirements
- Add export command: “Export LLM Spec”.
- Export includes:
  - role, meta, constraints, contract
  - layout as anchored (preferred)
  - optional derived absolute rects for readability
  - Option to redact editor-only fields.

### Acceptance Criteria
- LLM export is deterministic (same input -> same output ordering).
- Exported spec can be used to reconstruct layout in Unity with minimal interpretation.