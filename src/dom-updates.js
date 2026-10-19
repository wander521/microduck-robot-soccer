// Reflected properties and textContent still mutate the DOM when assigned the
// same value. Keep 50 Hz snapshots from rebuilding unchanged HUD text nodes.
export function setText(element, value) {
  const text = String(value);
  if (element.textContent === text) return false;
  element.textContent = text;
  return true;
}

export function setAttribute(element, name, value) {
  const text = String(value);
  if (element.getAttribute(name) !== text) element.setAttribute(name, text);
}

export function setProperty(element, name, value) {
  if (element[name] !== value) element[name] = value;
}
