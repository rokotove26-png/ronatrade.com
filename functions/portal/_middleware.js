// Canonical portal interfaces are frozen. This middleware must not mutate
// Admin / Agent / Client HTML, DOM, CSS, text, navigation, or visible controls.
// Authentication and role gating are handled by functions/portal/[[path]].js.
// Any future visual/runtime adaptation of the three canonical portals requires
// explicit owner approval and a zero-pixel canonical regression gate.

export async function onRequest(context) {
  return context.next();
}
