// Turns simple CMS markup into safe HTML.
// [[text]] = red highlight, **text** = bold white text.
const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function rich(text = '') {
  return esc(text)
    .replace(/\[\[(.+?)\]\]/g, '<span class="hl">$1</span>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="hl-white">$1</strong>');
}

export function plain(text = '') {
  return String(text).replace(/\[\[(.+?)\]\]/g, '$1').replace(/\*\*(.+?)\*\*/g, '$1');
}
