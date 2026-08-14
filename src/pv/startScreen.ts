export interface StartScreen {
  setLoading(pct: number | null): void;
  show(): void;
  hide(): void;
  dispose(): void;
}

export function createStartScreen(opts: {
  onStart: () => void;
  vrSupported: boolean;
}): StartScreen {
  const overlay = document.createElement('div');
  overlay.className = 'pv-start-screen';

  const button = document.createElement('button');
  button.type = 'button';
  button.disabled = true;
  overlay.append(button);
  document.body.append(overlay);

  const readyLabel = opts.vrSupported ? '▶ 体験をはじめる' : '▶ 再生（PCプレビュー）';
  const onClick = () => {
    if (!button.disabled) opts.onStart();
  };
  button.addEventListener('click', onClick);

  const setLoading = (pct: number | null) => {
    const ready = pct !== null && pct >= 100;
    button.disabled = !ready;
    button.textContent = ready
      ? readyLabel
      : pct !== null && pct > 0
        ? `読み込み中… ${Math.min(99, Math.round(pct))}%`
        : '読み込み中…';
  };
  setLoading(null);

  return {
    setLoading,
    show() { overlay.hidden = false; },
    hide() { overlay.hidden = true; },
    dispose() {
      button.removeEventListener('click', onClick);
      overlay.remove();
    },
  };
}
