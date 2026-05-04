import { BadRequestError } from "../errors/app-error.js";

const PRIVATE_IPV4_RE =
  /^(10\.|192\.168\.|127\.|0\.0\.0\.0|169\.254\.|172\.(1[6-9]|2[0-9]|3[01])\.)/;

/**
 * Garante HTTPS público e bloqueia destinos óbvios de SSRF (local / link-local / RFC1918 em hostname).
 */
export function assertSafeHttpsImageUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new BadRequestError("URL de imagem inválida.");
  }
  if (url.protocol !== "https:") {
    throw new BadRequestError("Apenas URLs HTTPS são permitidas para imagens.");
  }
  if (url.username || url.password) {
    throw new BadRequestError("URL de imagem não pode incluir credenciais.");
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "metadata.google.internal" ||
    host === "metadata" ||
    host.endsWith(".localhost")
  ) {
    throw new BadRequestError("URL de imagem bloqueada (hostname não permitido).");
  }
  if (PRIVATE_IPV4_RE.test(host)) {
    throw new BadRequestError("URL de imagem bloqueada (rede privada ou local).");
  }
  return url;
}
