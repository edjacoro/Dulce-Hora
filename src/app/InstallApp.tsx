import { useEffect, useState } from "react";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const display = window.matchMedia("(display-mode: standalone)");
    const update = () => setInstalled(display.matches);
    const ready = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const done = () => { setInstalled(true); setPrompt(null); };
    update();
    display.addEventListener("change", update);
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", done);
    return () => {
      display.removeEventListener("change", update);
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", done);
    };
  }, []);

  async function install() {
    if (!prompt) { setHelp((value) => !value); return; }
    setBusy(true);
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      setHelp(true);
    } finally {
      setPrompt(null);
      setBusy(false);
    }
  }

  if (installed) return null;
  return <div className="install-app">
    <button type="button" className="icon-text-button" disabled={busy} onClick={() => void install()}>
      {busy ? "Abriendo instalación…" : "Instalar Dulce Hora"}
    </button>
    {help && <p role="status">En Chrome para Android, abrí el menú ⋮ y elegí «Instalar aplicación» o «Agregar a la pantalla principal». Si no aparece, volvé a abrir este sitio en Chrome. La app necesita Internet y conserva tu inicio de sesión.</p>}
  </div>;
}
