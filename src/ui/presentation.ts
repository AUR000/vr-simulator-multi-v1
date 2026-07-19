/**
 * プレゼンモード: UIを隠してブラウザ全画面表示にする(legacy CSS版のプレゼンモード相当)。
 * 解除は Esc(ブラウザ標準) または H キー。全画面状態と body.presentation クラスを同期する。
 */
export function createPresentationMode() {
  const onKeyDown = (event: KeyboardEvent) => {
    if ((event.key === 'h' || event.key === 'H') && document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    }
  };
  const onChange = () => document.body.classList.toggle('presentation', !!document.fullscreenElement);
  document.addEventListener('fullscreenchange', onChange);
  addEventListener('keydown', onKeyDown);
  return {
    enter() { document.documentElement.requestFullscreen().catch(() => undefined); },
    dispose() {
      document.removeEventListener('fullscreenchange', onChange);
      removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('presentation');
    },
  };
}
