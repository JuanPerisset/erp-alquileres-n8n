import { useEffect, useState } from "react";

import { api, apiError } from "@/lib/api";

export function useApi(url) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let vivo = true;
    setError("");
    api.get(url)
      .then((r) => vivo && setData(r.data))
      .catch((e) => vivo && setError(apiError(e)));
    return () => { vivo = false; };
  }, [url, tick]);

  return { data, error, recargar: () => setTick((t) => t + 1) };
}
