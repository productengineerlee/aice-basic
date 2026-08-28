/** Open-redirect guard shared by the login flow and /auth/callback: only allow same-origin
 * relative paths, otherwise fall back to a safe default. Kept out of auth/actions.ts because
 * every export of a "use server" file must be an async function (a Server Action), and this is a
 * plain sync helper. */
export function safeNext(value: FormDataEntryValue | string | null | undefined, fallback = "/dashboard") {
  const text = typeof value === "string" ? value : "";
  return text.startsWith("/") && !text.startsWith("//") ? text : fallback;
}
