import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

let configured = false;

export function setupMonacoEnvironment(): void {
  if (configured) return;
  configured = true;

  self.MonacoEnvironment = {
    getWorker(_workerId: string, label: string) {
      if (
        label === 'editor' ||
        label === 'diffEditor' ||
        label === 'typescript' ||
        label === 'javascript' ||
        label === 'json' ||
        label === 'css' ||
        label === 'html'
      ) {
        return new EditorWorker();
      }
      return new Worker(
        URL.createObjectURL(
          new Blob(['self.onmessage = () => {}'], { type: 'text/javascript' })
        )
      );
    }
  };
}
