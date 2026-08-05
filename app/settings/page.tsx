import { readConfig } from "@/lib/config";
import SettingsForm from "@/app/components/SettingsForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const config = readConfig();
  return (
    <>
      <h1>Configurações</h1>
      <p className="subtitle">Meses permitidos, duração da viagem e horizonte de busca.</p>
      <div className="card">
        <SettingsForm initialConfig={config} />
      </div>
    </>
  );
}
