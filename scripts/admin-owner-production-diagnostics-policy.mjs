const BUILD_INDICATOR_CREATOR = "function indicator(){style();let n=document.getElementById('rona-owner-build-indicator');if(!n&&document.body){n=document.createElement('div');n.id='rona-owner-build-indicator';document.body.appendChild(n)}return n}";
const BUILD_INDICATOR_DISABLED = "function indicator(){return null}";
const BUILD_INDICATOR_TIMER = "style();updateIndicator();setInterval(updateIndicator,1000);";
const BUILD_INDICATOR_TIMER_DISABLED = "style();";

export function stripOwnerBuildIndicator(source) {
  const input = String(source ?? '');
  const alreadySafe =
    input.includes(BUILD_INDICATOR_DISABLED) &&
    !input.includes("n.id='rona-owner-build-indicator'") &&
    !input.includes('setInterval(updateIndicator,1000)');

  if (alreadySafe) return input;

  if (!input.includes(BUILD_INDICATOR_CREATOR)) {
    throw new Error('OWNER_BUILD_INDICATOR_POLICY_UNRECOGNIZED_RUNTIME');
  }
  if (!input.includes(BUILD_INDICATOR_TIMER)) {
    throw new Error('OWNER_BUILD_INDICATOR_POLICY_TIMER_NOT_FOUND');
  }

  const output = input
    .replace(BUILD_INDICATOR_CREATOR, BUILD_INDICATOR_DISABLED)
    .replace(BUILD_INDICATOR_TIMER, BUILD_INDICATOR_TIMER_DISABLED);

  if (
    output.includes("n.id='rona-owner-build-indicator'") ||
    output.includes('setInterval(updateIndicator,1000)') ||
    !output.includes(BUILD_INDICATOR_DISABLED)
  ) {
    throw new Error('OWNER_BUILD_INDICATOR_POLICY_ENFORCEMENT_FAILED');
  }

  return output;
}
