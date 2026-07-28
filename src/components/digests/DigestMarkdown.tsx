import ReactMarkdown from "react-markdown";

export function DigestMarkdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      components={{
        p: (props) => (
          <p className="mb-3 leading-relaxed text-on-surface-variant" {...props} />
        ),
        strong: (props) => <strong className="text-on-surface" {...props} />,
        ul: (props) => (
          <ul className="mb-3 list-disc pl-5 text-on-surface-variant" {...props} />
        ),
        li: (props) => <li className="mb-1" {...props} />,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
