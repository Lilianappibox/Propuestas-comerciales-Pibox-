import { useState } from "react";
import { authenticate } from "../data/users";
import PiboxLogo from "./PiboxLogo";

export default function Login({ users, onLogin }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    const user = authenticate(users, email, password);
    if (user) onLogin(user);
    else setError("Correo o contraseña incorrectos, o usuario inactivo.");
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #5B17A8 0%, #7C22D4 45%, #C026D3 100%)" }}
    >
      {/* Puntos decorativos — identidad visual PIBOX */}
      <span className="absolute top-5 right-5 text-white/30 text-2xl select-none">⋮⋮</span>
      <span className="absolute bottom-5 left-5 text-white/30 text-2xl select-none">⋮⋮</span>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <PiboxLogo size="lg" white />
          <p className="text-white/70 text-sm mt-3 tracking-wide">Tablero Comercial</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-1">Iniciar sesión</h2>
          <p className="text-sm text-gray-500 mb-6">Ingresa tus credenciales para continuar</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">
                Correo electrónico
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ "--tw-ring-color": "#7C22D4" }}
                placeholder="usuario@pibox.app"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 pr-14 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-medium"
                >
                  {showPass ? "Ocultar" : "Ver"}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 mt-2"
              style={{ background: "linear-gradient(135deg, #7C22D4, #C026D3)" }}
            >
              Ingresar
            </button>
          </form>
        </div>

        <p className="text-center text-white/50 text-xs mt-6">
          Digital Platforms Colombia SAS © 2026
        </p>
      </div>
    </div>
  );
}
