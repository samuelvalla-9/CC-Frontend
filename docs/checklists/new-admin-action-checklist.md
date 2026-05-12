# New Admin Action Checklist

Use this checklist for every new admin mutation action.

- [ ] Added unique action key function/value.
- [ ] Added guard: `if (!beginAction(key)) return;`.
- [ ] Added cleanup: `.pipe(finalize(() => endAction(key)))`.
- [ ] Added normalized error toast with `extractErrorMessage`.
- [ ] Bound button disable to `isActionInFlight(key)`.
- [ ] Added in-progress label text.
- [ ] Preserved business validation (role/state checks, confirmations).
- [ ] Verified behavior on success, failure, and rapid repeated clicks.
- [ ] Verified no stuck loading state remains after failure.
