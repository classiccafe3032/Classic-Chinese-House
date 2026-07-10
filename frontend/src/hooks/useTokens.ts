import { useEffect, useState } from "react";
import { apiGetTokens } from "@/lib/apiClient";

type TokenRow = {
  id: string;
  token: number;
  status: "new" | "preparing" | "ready" | "completed";
};

export function useTokens(intervalMs = 3000) {
  const [tokens, setTokens] = useState<TokenRow[]>([]);

  async function loadTokens() {
    try {
      const data = await apiGetTokens();
      setTokens(data as TokenRow[]);
    } catch (err) {
      console.error("Failed to fetch tokens:", err);
    }
  }

  useEffect(() => {
    loadTokens();
    const id = setInterval(loadTokens, intervalMs);
    return () => clearInterval(id);
  }, []);

  return { tokens };
}
