interface NappletFrameProps {
  readonly srcdoc: string;
  readonly title: string;
}

export function NappletFrame({ srcdoc, title }: NappletFrameProps) {
  return (
    <iframe
      sandbox="allow-scripts"
      srcDoc={srcdoc}
      title={title}
      class="h-full min-h-[70vh] w-full border-0 bg-white"
    />
  );
}
