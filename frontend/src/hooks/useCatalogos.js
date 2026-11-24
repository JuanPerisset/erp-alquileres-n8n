import { useEffect, useState } from "react";
import { api } from "@/lib/api";

let cache = null;
const subs = new Set();

export function invalidarCatalogos() {
  cache = null;
  subs.forEach((f) => f());
}

export function useCatalogos() {
  const [data, setData] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const f = () => setTick((t) => t + 1);
    subs.add(f);
    return () => subs.delete(f);
  }, []);

  useEffect(() => {
    let vivo = true;
    cache = cache || api.get("/catalogos").then((r) => r.data);
    cache.then((d) => vivo && setData(d)).catch(() => { cache = null; });
    return () => { vivo = false; };
  }, [tick]);

  return data;
}
