interface NappletFrameProps {
  readonly srcdoc: string;
  readonly title: string;
  readonly onFrame: (frame: HTMLIFrameElement | null) => void;
}

export function NappletFrame({ srcdoc, title, onFrame }: NappletFrameProps) {
  return (
    <iframe
      ref={onFrame}
      sandbox="allow-scripts"
      srcDoc={srcdoc}
      title={title}
      class="h-full min-h-[70vh] w-full border-0 bg-white"
    />
  );
}
