import { Database } from "lucide-react";

type Props = {
  title: string;
  noun: string;
};

export function EmptyModulePage({ title, noun }: Props) {
  return (
    <section className="page-section">
      <div className="page-heading">
        <div>
          <h1>{title}</h1>
          <p>Sin {noun}</p>
        </div>
      </div>

      <div className="content-band">
        <div className="empty-state">
          <Database size={22} aria-hidden="true" />
          <div>
            <h2>Esperando datos reales</h2>
            <p>Este módulo se activa cuando existan registros importados o sincronizados.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
