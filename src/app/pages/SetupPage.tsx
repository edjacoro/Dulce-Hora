import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "../api";
import { dulceHoraLogo } from "../brand";

const setupSchema = z.object({
  organizationName: z.string().min(2, "Ingresá el nombre del negocio"),
  taxId: z.string().optional(),
  branchName: z.string().min(2, "Ingresá la sucursal"),
  branchAddress: z.string().optional(),
  ownerName: z.string().min(2, "Ingresá tu nombre"),
  ownerEmail: z.string().email("Ingresá un email válido"),
  ownerPassword: z.string().min(10, "Usá al menos 10 caracteres")
});

type SetupForm = z.infer<typeof setupSchema>;

export function SetupPage() {
  const queryClient = useQueryClient();
  const form = useForm<SetupForm>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      organizationName: "Dulce Hora",
      taxId: "",
      branchName: "Villa Urquiza",
      branchAddress: "",
      ownerName: "",
      ownerEmail: "",
      ownerPassword: ""
    }
  });

  const setup = useMutation({
    mutationFn: (values: SetupForm) =>
      api<{ ok: true }>("/api/setup", {
        method: "POST",
        body: JSON.stringify(values)
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    }
  });

  return (
    <div className="auth-screen">
      <section className="auth-panel setup-panel">
        <div className="auth-heading">
          <img className="auth-logo" src={dulceHoraLogo} alt="" />
          <div>
            <h1>Dulce Hora Control</h1>
            <p>Configuración inicial local</p>
          </div>
        </div>

        <form className="form-grid" onSubmit={form.handleSubmit((values) => setup.mutate(values))}>
          <label>
            Negocio
            <input {...form.register("organizationName")} />
            <small>{form.formState.errors.organizationName?.message}</small>
          </label>

          <label>
            CUIT
            <input {...form.register("taxId")} />
          </label>

          <label>
            Sucursal
            <input {...form.register("branchName")} />
            <small>{form.formState.errors.branchName?.message}</small>
          </label>

          <label>
            Dirección
            <input {...form.register("branchAddress")} />
          </label>

          <label>
            Tu nombre
            <input {...form.register("ownerName")} />
            <small>{form.formState.errors.ownerName?.message}</small>
          </label>

          <label>
            Email de acceso
            <input autoComplete="email" type="email" {...form.register("ownerEmail")} />
            <small>{form.formState.errors.ownerEmail?.message}</small>
          </label>

          <label className="full">
            Contraseña
            <input
              autoComplete="new-password"
              type="password"
              {...form.register("ownerPassword")}
            />
            <small>{form.formState.errors.ownerPassword?.message}</small>
          </label>

          {setup.error ? <p className="form-error">{setup.error.message}</p> : null}

          <button className="primary-button full" disabled={setup.isPending} type="submit">
            <Building2 size={18} aria-hidden="true" />
            Crear espacio local
          </button>
        </form>
      </section>
    </div>
  );
}
