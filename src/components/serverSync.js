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
    const res = await fetch(`/api/snapshot/${modulo}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function clearFromServer(modulo) {
  const token = window.__RAILS_CSRF_TOKEN__;
  const res = await fetch(`/api/snapshot/${modulo}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-CSRF-Token": token } : {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
