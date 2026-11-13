async function api(url, method = "GET", body) {
  const headers = {
    "Content-Type": "application/json",
    ...(session ? { Authorization: "Bearer " + session.token } : {}),
  };
  if (["POST", "PATCH", "PUT", "DELETE"].includes(method))
    headers["Idempotency-Key"] = crypto.randomUUID();
  const response = await fetch("/api" + url, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.message || "Something went wrong. Please try again.");
  return data;
}