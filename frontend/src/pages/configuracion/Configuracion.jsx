import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/context/AuthContext";
import TablasBD from "./TablasBD";
import Catalogos from "./Catalogos";
import Webhooks from "./Webhooks";
import Operacion from "./Operacion";
import Usuarios from "./Usuarios";

export default function Configuracion() {
  const { esAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const validas = ["base", "catalogos", "webhooks", "operacion", ...(esAdmin ? ["usuarios"] : [])];
  const tab = validas.includes(params.get("tab")) ? params.get("tab") : "base";

  return (
    <div>
      <PageHeader eyebrow="Sistema" titulo="Configuración"
        descripcion="Estado de la base de datos, catálogos de solo lectura, webhooks de n8n y usuarios de la app." />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList className="mb-6 h-auto flex-wrap justify-start" data-testid="config-tabs">
          <TabsTrigger value="base" data-testid="config-tab-base">Base de datos</TabsTrigger>
          <TabsTrigger value="catalogos" data-testid="config-tab-catalogos">Catálogos y mora</TabsTrigger>
          <TabsTrigger value="webhooks" data-testid="config-tab-webhooks">Webhooks n8n</TabsTrigger>
          <TabsTrigger value="operacion" data-testid="config-tab-operacion">Operación</TabsTrigger>
          {esAdmin && <TabsTrigger value="usuarios" data-testid="config-tab-usuarios">Usuarios</TabsTrigger>}
        </TabsList>
        <TabsContent value="base"><TablasBD /></TabsContent>
        <TabsContent value="catalogos"><Catalogos /></TabsContent>
        <TabsContent value="webhooks"><Webhooks /></TabsContent>
        <TabsContent value="operacion"><Operacion /></TabsContent>
        {esAdmin && <TabsContent value="usuarios"><Usuarios /></TabsContent>}
      </Tabs>
    </div>
  );
}
