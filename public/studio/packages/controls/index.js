/** Framework-independent editor control primitives. */
export const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export class CommandRegistry {
    constructor() { this.commands = new Map(); }
    register(id, label, run, shortcut = '') { this.commands.set(id, { id, label, run, shortcut }); return () => this.commands.delete(id); }
    execute(id) { return this.commands.get(id)?.run(); }
    search(query = '') { return [...this.commands.values()].filter(x => x.label.toLowerCase().includes(query.toLowerCase())); }
}
export class PanelResizer {
    constructor(handle, target, axis = 'x', min = 200, max = 600) { this.down = e => { e.preventDefault(); const start = axis === 'x' ? e.clientX : e.clientY, initial = axis === 'x' ? target.offsetWidth : target.offsetHeight; handle.setPointerCapture(e.pointerId); const move = e => { let size = Math.max(min, Math.min(max, initial + start - (axis === 'x' ? e.clientX : e.clientY))); target.style[axis === 'x' ? 'width' : 'height'] = size + 'px'; target.dispatchEvent(new Event('resize')); }; const up = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); }; handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up); }; handle.addEventListener('pointerdown', this.down); this.handle = handle; }
    dispose() { this.handle.removeEventListener('pointerdown', this.down); }
}
export function download(data, name, type = 'application/json') { let blob = data instanceof Blob ? data : new Blob([data], { type }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
export function debounce(fn, ms = 400) { let t; const f = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; f.cancel = () => clearTimeout(t); return f; }
export class AstrumNumber extends (globalThis.HTMLElement || class {
}) {
    connectedCallback() { if (this.firstChild)
        return; let label = document.createElement('label'); label.textContent = this.getAttribute('label') || ''; let input = document.createElement('input'); input.type = 'number'; input.step = this.getAttribute('step') || '0.1'; input.value = this.getAttribute('value') || '0'; input.setAttribute('aria-label', label.textContent); for (let k of ['min', 'max'])
        if (this.hasAttribute(k))
            input[k] = this.getAttribute(k); this.append(label, input); input.addEventListener('change', () => this.dispatchEvent(new CustomEvent('value-change', { bubbles: true, detail: Number(input.value) }))); this.input = input; }
    get value() { return Number(this.input?.value || 0); }
    set value(v) { if (this.input)
        this.input.value = v; }
}
if (globalThis.customElements && !customElements.get('astrum-number'))
    customElements.define('astrum-number', AstrumNumber);
