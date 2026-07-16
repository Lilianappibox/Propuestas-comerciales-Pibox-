export async function publishToServer(modulo, data) {
  const token = window.__RAILS_CSRF_TOKEN__;
  const res = await fetch(`/api/snapshot/${modulo}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-CSRF-Token": token } : {}),
    },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchFromServer(modulo) {
  try {
    const res = await fetch(`/api/snapshot/${modulo}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null; // error de red / 502 / 401 → null señaliza "no conectó"
    const json = await res.json();
    return json; // puede ser { ok: true, data: ... } o { ok: false, data: null }
  } catch {
    return null;
  }
}

// Publica UN solo mes, mergeando con el snapshot existente en el servidor.
// Reduce el payload de ~20 MB (todos los meses) a ~7 MB (un mes).
export async function publishMonthToServer(modulo, mesKey, mesData, metadata) {
  const token = window.__RAILS_CSRF_TOKEN__;
  const res = await fetch(`/api/snapshot/${modulo}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { "X-CSRF-Token": token } : {}),
    },
    body: JSON.stringify({ mes: mesKey, mes_data: mesData, ...metadata }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function clearFromServer(modulo) {
  const token = window.__RAILS_CSRF_TOKEN__;
  const res = await fetch(`/api/snapshot/${modulo}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { "X-CSRF-Token": token } : {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
