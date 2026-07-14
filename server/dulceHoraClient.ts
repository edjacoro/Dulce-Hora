const baseUrl = "https://pedidosdulcehora.com.ar";

export type DulceHoraCredentials = {
  username: string;
  password: string;
};

export type RegistryEntry = {
  externalId: string;
  displayType: string;
  cells: string[];
};

export type ProductCatalogItem = {
  source: "product" | "custom";
  id: string;
  name: string;
  category?: string;
  fractioning?: string;
};

export type DulceHoraDocument = {
  listing: RegistryEntry;
  detail: Record<string, unknown>;
};

export type DulceHoraWasteProduct = {
  id: string;
  code?: string;
  name: string;
  category?: string;
  fractioning?: string;
};

export type DulceHoraWasteLine = {
  productId: string;
  quantity: number;
  totalCost: number;
  raw: unknown;
};

export type DulceHoraWasteEvent = {
  id: string;
  occurredAt: string;
  userName: string | null;
  active: boolean;
  lines: DulceHoraWasteLine[];
  raw: Record<string, unknown>;
};

export type DulceHoraWastePayload = {
  products: Map<string, DulceHoraWasteProduct>;
  events: DulceHoraWasteEvent[];
};

export type DulceHoraStatisticsPayload = {
  catalog: Map<string, ProductCatalogItem>;
  documents: Array<Record<string, unknown>>;
  dailySummaries: Array<Record<string, unknown>>;
};

export class DulceHoraRateLimitError extends Error {
  constructor(message = "Dulce Hora limito temporalmente la lectura de comprobantes") {
    super(message);
    this.name = "DulceHoraRateLimitError";
  }
}

export class DulceHoraClient {
  private readonly cookies = new Map<string, string>();
  private readonly requestDelayMs: number;

  constructor(
    private readonly credentials: DulceHoraCredentials,
    requestDelayMs = Number(process.env.DULCE_HORA_REQUEST_DELAY_MS ?? 600)
  ) {
    this.requestDelayMs = requestDelayMs;
  }

  async login() {
    await this.fetchWithCookies("/login");

    const response = await this.fetchWithCookies("/login", {
      method: "POST",
      body: new URLSearchParams({
        loginUsuario: this.credentials.username,
        loginPassword: this.credentials.password
      }),
      redirect: "manual"
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location") ?? "/panel";
      await this.wait();
      await this.fetchWithCookies(location.startsWith("http") ? location : location);
      return;
    }

    if (!response.ok) {
      throw new Error("No se pudo iniciar sesion en Dulce Hora");
    }
  }

  async fetchRegistry(date: string): Promise<RegistryEntry[]> {
    const dateParam = date.replaceAll("-", "");
    await this.wait();
    const response = await this.fetchWithCookies(`/panel/facturacion/registros?fecha=${dateParam}`);
    const html = await response.text();

    if (response.url.endsWith("/login") || html.includes('id="loginForm"')) {
      throw new Error("La sesion de Dulce Hora no quedo autenticada");
    }

    return parseRegistryEntries(html);
  }

  async fetchCatalog(): Promise<Map<string, ProductCatalogItem>> {
    await this.wait();
    const response = await this.fetchWithCookies("/panel/facturacion");
    const html = await response.text();
    const items = [
      ...extractCatalogArray(html, "productos", "product"),
      ...extractCatalogArray(html, "botonesPersonalizados", "custom")
    ];

    if (!items.some((item) => item.source === "product")) {
      await this.wait();
      const fallbackResponse = await this.fetchWithCookies("/panel/desperdicios/local");
      const fallbackHtml = await fallbackResponse.text();
      items.push(...parseWasteProducts(fallbackHtml).map((product) => ({
        source: "product" as const,
        id: product.id,
        name: product.name,
        category: product.category,
        fractioning: product.fractioning
      })));
    }
    items.push(...(await this.fetchPersonalizedProducts()));

    return new Map(items.map((item) => [`${item.source}:${item.id}`, item]));
  }

  async fetchStatistics(): Promise<DulceHoraStatisticsPayload> {
    await this.wait();
    const response = await this.fetchWithCookies("/panel/estadisticas/local");
    const html = await response.text();

    if (response.url.endsWith("/login") || html.includes('id="loginForm"')) {
      throw new Error("La sesion de Dulce Hora no quedo autenticada");
    }

    const products = [
      ...extractCatalogArray(html, "productos", "product"),
      ...(await this.fetchPersonalizedProducts())
    ];
    return {
      catalog: new Map(products.map((item) => [`${item.source}:${item.id}`, item])),
      documents: extractWindowArray(html, "facturas"),
      dailySummaries: extractWindowArray(html, "resumenVentas")
    };
  }

  private async fetchPersonalizedProducts(): Promise<ProductCatalogItem[]> {
    await this.wait();
    const response = await this.fetchWithCookies("/panel/facturacion/local/productos/personalizados");
    const html = await response.text();
    if (response.url.endsWith("/login") || html.includes('id="loginForm"')) return [];
    return parsePersonalizedProducts(html);
  }

  async fetchWasteRecords(): Promise<DulceHoraWastePayload> {
    await this.wait();
    const response = await this.fetchWithCookies("/panel/desperdicios/local");
    const html = await response.text();

    if (response.url.endsWith("/login") || html.includes('id="loginForm"')) {
      throw new Error("La sesion de Dulce Hora no quedo autenticada");
    }

    const products = parseWasteProducts(html);
    const events = parseWasteEvents(html);
    return { products: new Map(products.map((product) => [product.id, product])), events };
  }

  async fetchDocument(entry: RegistryEntry): Promise<DulceHoraDocument> {
    const path = documentPath(entry);
    await this.wait();
    const response = await this.fetchWithCookies(path);

    if (!response.ok) {
      throw new Error(`No se pudo leer el comprobante ${entry.displayType}:${entry.externalId}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    const body = await response.text();
    if (response.url.endsWith("/302.html") || body.includes("Excediste la cantidad de intentos")) {
      throw new DulceHoraRateLimitError();
    }
    if (!contentType.includes("application/json")) {
      throw new Error(`Dulce Hora no devolvio JSON para ${entry.displayType}:${entry.externalId}`);
    }

    const detail = JSON.parse(body) as Record<string, unknown>;
    if (detail.error) {
      throw new Error(String(detail.msg ?? "El panel devolvio error al leer comprobante"));
    }

    return { listing: entry, detail };
  }

  private async wait() {
    if (this.requestDelayMs <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, this.requestDelayMs));
  }

  private async fetchWithCookies(path: string, init: RequestInit = {}) {
    const url = path.startsWith("http") ? path : `${baseUrl}${path}`;
    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
        "Accept-Language": "es-AR,es;q=0.9,en;q=0.7",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
        ...(init.body instanceof URLSearchParams
          ? { "Content-Type": "application/x-www-form-urlencoded" }
          : {}),
        ...(this.cookieHeader() ? { Cookie: this.cookieHeader() } : {}),
        ...init.headers
      }
    });

    this.storeCookies(response.headers);
    return response;
  }

  private cookieHeader() {
    return [...this.cookies.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
  }

  private storeCookies(headers: Headers) {
    const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
    const values = getSetCookie ? getSetCookie.call(headers) : splitSetCookie(headers.get("set-cookie"));

    for (const header of values) {
      const [pair] = header.split(";");
      const separator = pair.indexOf("=");
      if (separator === -1) continue;
      this.cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  }
}

export function getDulceHoraCredentials(): DulceHoraCredentials | null {
  const username = process.env.DULCE_HORA_USERNAME;
  const password = process.env.DULCE_HORA_PASSWORD;
  if (!username || !password) return null;
  return { username, password };
}

export function dulceHoraCredentialsConfigured() {
  return Boolean(process.env.DULCE_HORA_USERNAME && process.env.DULCE_HORA_PASSWORD);
}

function documentPath(entry: RegistryEntry) {
  if (entry.displayType === "X") {
    return `/panel/facturacion/comprobante?id=${encodeURIComponent(entry.externalId)}`;
  }
  if (entry.displayType === "S") {
    return `/panel/facturacion/comprobante/parcial?id=${encodeURIComponent(entry.externalId)}`;
  }
  return `/panel/facturacion/comprobante/fiscal?id=${encodeURIComponent(entry.externalId)}`;
}

function parseRegistryEntries(html: string): RegistryEntry[] {
  const rows = html.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [];
  const entries = new Map<string, RegistryEntry>();

  for (const row of rows) {
    const action = (row.match(/<img\b[^>]*class="[^"]*\breimprimirTicket\b[^"]*"[^>]*>/i) ??
      row.match(/<img\b(?=[^>]*\breimprimirTicket\b)[^>]*>/i))?.[0];
    if (!action) continue;

    const externalId = getAttribute(action, "data-id");
    const displayType = getAttribute(action, "data-tipo");
    if (!externalId || !displayType) continue;

    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) =>
      cleanText(match[1])
    );
    entries.set(`${displayType}:${externalId}`, { externalId, displayType, cells });
  }

  return [...entries.values()];
}

function extractCatalogArray(
  html: string,
  variableName: string,
  source: ProductCatalogItem["source"]
): ProductCatalogItem[] {
  const decoded = decodeEntities(html);
  const candidates = [
    extractWindowJsonArray(decoded, variableName),
    ...[
      new RegExp(`(?:let|const|var)\\s+${variableName}\\s*=\\s*(\\[[\\s\\S]*?\\]);`, "i"),
      new RegExp(`${variableName}\\s*=\\s*(\\[[\\s\\S]*?\\]);`, "i")
    ]
      .map((pattern) => decoded.match(pattern)?.[1])
      .filter((value): value is string => Boolean(value))
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Array<Record<string, unknown>>;
      return parsed
        .map((item) => ({
          source,
          id: String(item.id ?? item.codigo ?? ""),
          name: String(item.nombre ?? item.detalle ?? ""),
          category: item.categoria ? String(item.categoria) : undefined,
          fractioning: item.fraccionamiento ? String(item.fraccionamiento) : undefined
        }))
        .filter((item) => item.id && item.name);
    } catch {
      continue;
    }
  }

  return [];
}

function extractWindowArray(html: string, variableName: string): Array<Record<string, unknown>> {
  const decoded = decodeEntities(html);
  const candidate = extractWindowJsonArray(decoded, variableName);
  if (!candidate) return [];

  try {
    const parsed = JSON.parse(candidate) as unknown;
    return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
  } catch {
    return [];
  }
}

function parseWasteProducts(html: string): DulceHoraWasteProduct[] {
  const decoded = decodeEntities(html);
  const candidate = extractWindowJsonArray(decoded, "productosLocal");
  if (!candidate) return [];

  try {
    const parsed = JSON.parse(candidate) as Array<Record<string, unknown>>;
    return parsed
      .map((item) => ({
        id: String(item.id ?? ""),
        code: item.codigo !== undefined ? String(item.codigo) : undefined,
        name: String(item.nombre ?? ""),
        category: item.categoria ? String(item.categoria) : undefined,
        fractioning: item.fraccionamiento ? String(item.fraccionamiento) : undefined
      }))
      .filter((item) => item.id && item.name);
  } catch {
    return [];
  }
}

function parseWasteEvents(html: string): DulceHoraWasteEvent[] {
  const decoded = decodeEntities(html);
  const candidate = extractWindowJsonArray(decoded, "desperdicios");
  if (!candidate) return [];

  try {
    const parsed = JSON.parse(candidate) as Array<Record<string, unknown>>;
    return parsed
      .map((item) => {
        const lines = parseWasteLines(item.datos);
        return {
          id: String(item.id ?? ""),
          occurredAt: String(item.fechaevento ?? ""),
          userName: item.usuario ? String(item.usuario) : null,
          active: String(item.estado ?? "true") === "true",
          lines,
          raw: item
        };
      })
      .filter((item) => item.id && item.occurredAt && item.lines.length > 0);
  } catch {
    return [];
  }
}

function parsePersonalizedProducts(html: string): ProductCatalogItem[] {
  const rows = html.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [];
  const items: ProductCatalogItem[] = [];

  for (const row of rows) {
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) =>
      cleanText(match[1])
    );
    const code = cells[0];
    const name = cells[1];
    if (!code || !name || code.toLowerCase() === "codigo") continue;

    const internalId = row.match(/data-id="([^"]+)"/i)?.[1];
    items.push({ source: "custom", id: code, name });
    if (internalId && internalId !== code) {
      items.push({ source: "custom", id: internalId, name });
    }
  }

  return items;
}

function parseWasteLines(value: unknown): DulceHoraWasteLine[] {
  let rows: unknown = value;
  if (typeof value === "string") {
    try {
      rows = JSON.parse(value) as unknown;
    } catch {
      return [];
    }
  }

  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => {
      const values = Array.isArray(row) ? row : [];
      return {
        productId: String(values[0] ?? ""),
        quantity: toNumber(values[1]),
        totalCost: toNumber(values[2]),
        raw: row
      };
    })
    .filter((line) => line.productId && line.quantity > 0);
}

function extractWindowJsonArray(html: string, variableName: string) {
  const marker = `window.${variableName} = `;
  const start = html.indexOf(marker);
  if (start === -1) return null;

  const arrayStart = html.indexOf("[", start + marker.length);
  if (arrayStart === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = arrayStart; index < html.length; index += 1) {
    const char = html[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "[") depth += 1;
    if (char === "]") depth -= 1;

    if (depth === 0) {
      return html.slice(arrayStart, index + 1);
    }
  }

  return null;
}

function getAttribute(tag: string, attribute: string) {
  return tag.match(new RegExp(`${attribute}="([^"]+)"`, "i"))?.[1] ?? "";
}

function cleanText(html: string) {
  return decodeEntities(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function decodeEntities(value: string) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#34;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&#x2F;", "/")
    .replaceAll("&amp;", "&")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&#xE1;", "a")
    .replaceAll("&#xE9;", "e")
    .replaceAll("&#xED;", "i")
    .replaceAll("&#xF3;", "o")
    .replaceAll("&#xFA;", "u")
    .replaceAll("&#xF1;", "n");
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function splitSetCookie(header: string | null) {
  if (!header) return [];
  return header.split(/,(?=\s*[^;,\s]+=)/g);
}
