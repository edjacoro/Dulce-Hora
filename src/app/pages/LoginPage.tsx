import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogIn } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "../api";
import { dulceHoraLogo } from "../brand";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Ingresá tu contraseña")
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const queryClient = useQueryClient();
  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" }
  });

  const login = useMutation({
    mutationFn: (values: LoginForm) =>
      api<{ ok: true }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(values)
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    }
  });

  return (
    <div className="auth-screen">
      <section className="auth-panel compact">
        <div className="auth-heading">
          <img className="auth-logo" src={dulceHoraLogo} alt="" />
          <div>
            <h1>Dulce Hora Control</h1>
            <p>Acceso administrativo</p>
          </div>
        </div>

        <form className="form-stack" onSubmit={form.handleSubmit((values) => login.mutate(values))}>
          <label>
            Email
            <input autoComplete="email" type="email" {...form.register("email")} />
            <small>{form.formState.errors.email?.message}</small>
          </label>

          <label>
            Contraseña
            <input autoComplete="current-password" type="password" {...form.register("password")} />
            <small>{form.formState.errors.password?.message}</small>
          </label>

          {login.error ? <p className="form-error">{login.error.message}</p> : null}

          <button className="primary-button" disabled={login.isPending} type="submit">
            <LogIn size={18} aria-hidden="true" />
            Entrar
          </button>
        </form>
      </section>
    </div>
  );
}
