import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useCatalogos } from "@/hooks/useCatalogos";
import { Campo, SelectCatalogo } from "./Campo";

export const ProvinciaCiudad = ({ idProvincia, idCiudad, onChange, errores = {}, prefijo }) => {
  const cat = useCatalogos();
  const [ciudades, setCiudades] = useState([]);

  useEffect(() => {
    if (!idProvincia) { setCiudades([]); return; }
    let vivo = true;
    api.get("/catalogos/ciudades", { params: { id_provincia: idProvincia } }).then((r) => vivo && setCiudades(r.data));
    return () => { vivo = false; };
  }, [idProvincia]);

  return (
    <>
      <Campo label="Provincia" error={errores.id_provincia}>
        <SelectCatalogo value={idProvincia} items={cat?.provincias || []} testId={`${prefijo}-provincia-select`}
          onChange={(v) => onChange({ id_provincia: v, id_ciudad: null })} />
      </Campo>
      <Campo label="Ciudad" error={errores.id_ciudad}>
        <SelectCatalogo value={idCiudad} items={ciudades} disabled={!idProvincia} testId={`${prefijo}-ciudad-select`}
          placeholder={idProvincia ? "Elegí la ciudad" : "Primero elegí la provincia"}
          onChange={(v) => onChange({ id_ciudad: v })} />
      </Campo>
    </>
  );
};
