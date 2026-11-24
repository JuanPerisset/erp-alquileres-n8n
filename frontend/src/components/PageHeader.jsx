export const PageHeader = ({ eyebrow, titulo, descripcion, children }) => (
  <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between fade-up">
    <div className="min-w-0">
      {eyebrow && <p className="label-caps mb-2">{eyebrow}</p>}
      <h1 className="text-2xl font-bold sm:text-3xl" data-testid="page-title">{titulo}</h1>
      {descripcion && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{descripcion}</p>}
    </div>
    {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
  </div>
);
