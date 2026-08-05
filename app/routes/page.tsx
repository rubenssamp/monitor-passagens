import { readConfig } from "@/lib/config";
import RoutesManager from "@/app/components/RoutesManager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function RoutesPage() {
  const config = readConfig();
  return (
    <>
      <h1>Rotas</h1>
      <p className="subtitle">Adicione, ative/desative ou remova rotas monitoradas.</p>
      <RoutesManager initialConfig={config} />
    </>
  );
}
