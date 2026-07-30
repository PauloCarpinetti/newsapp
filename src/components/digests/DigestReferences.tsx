export function DigestReferences({ references }: { references: string[] }) {
  if (references.length === 0) {
    return null;
  }

  return (
    <details className="mt-2 rounded-xl bg-surface-variant text-on-surface-variant">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold">
        Referências ({references.length})
      </summary>
      <ul className="space-y-1 px-3 pb-3 text-sm">
        {references.map((url) => (
          <li key={url} className="break-all">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:opacity-80"
            >
              {url}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
