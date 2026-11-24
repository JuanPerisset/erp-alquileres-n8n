import "@/App.css";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import { SECCIONES_PENDIENTES } from "@/components/layout/navConfig";
import { EstadoVacio } from "@/components/EstadoVacio";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import EnConstruccion from "@/pages/EnConstruccion";
import Configuracion from "@/pages/configuracion/Configuracion";
import PersonasPage from "@/pages/personas/PersonasPage";
import PropiedadesPage from "@/pages/propiedades/PropiedadesPage";
import PropiedadFicha from "@/pages/propiedades/PropiedadFicha";
import ContratosPage from "@/pages/contratos/ContratosPage";
import ContratoDetalle from "@/pages/contratos/ContratoDetalle";
import LiquidacionesPage from "@/pages/liquidaciones/LiquidacionesPage";
import LiquidacionDetalle from "@/pages/liquidaciones/LiquidacionDetalle";
import PagosPropietariosPage from "@/pages/pagos/PagosPropietariosPage";
import ActualizacionesPage from "@/pages/actualizaciones/ActualizacionesPage";
import ImpresionPage from "@/pages/impresion/ImpresionPage";
import ComunicacionesPage from "@/pages/comunicaciones/ComunicacionesPage";

const NoEncontrado = () => (
  <div className="space-y-4">
    <EstadoVacio testId="not-found" titulo="No encontramos esta página" texto="Revisá la dirección o volvé al inicio." />
    <Link to="/" className="text-sm underline" data-testid="not-found-home-link">Volver al inicio</Link>
  </div>
);

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              {Object.keys(SECCIONES_PENDIENTES).map((p) => <Route key={p} path={p.slice(1)} element={<EnConstruccion />} />)}
              <Route path="configuracion" element={<Configuracion />} />
              <Route path="inquilinos" element={<PersonasPage key="inquilinos" tipo="inquilinos" />} />
              <Route path="propietarios" element={<PersonasPage key="propietarios" tipo="propietarios" />} />
              <Route path="propiedades" element={<PropiedadesPage />} />
              <Route path="propiedades/:id" element={<PropiedadFicha />} />
              <Route path="contratos" element={<ContratosPage />} />
              <Route path="contratos/:id" element={<ContratoDetalle />} />
              <Route path="liquidaciones" element={<LiquidacionesPage />} />
              <Route path="liquidaciones/:id" element={<LiquidacionDetalle />} />
              <Route path="pagos-propietarios" element={<PagosPropietariosPage />} />
              <Route path="actualizaciones" element={<ActualizacionesPage />} />
              <Route path="impresion" element={<ImpresionPage />} />
              <Route path="comunicaciones" element={<ComunicacionesPage />} />
              <Route path="*" element={<NoEncontrado />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" richColors closeButton />
      </AuthProvider>
    </div>
  );
}

export default App;
