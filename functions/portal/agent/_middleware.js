// Agent Portal v0.4.3 is a frozen canonical interface.
// This middleware must not add, remove, rename, restyle, reposition, or rewrite
// any visible DOM, text, navigation control, form control, or layout element.
// Authentication, scope enforcement and live data binding are handled upstream
// without altering the approved rendered interface.

export async function onRequest(context) {
  return context.next();
}
