import React, { useState } from "react";
import { useAuthStore } from "../store/authStore.js";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Boxes, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [form, setForm] = useState();
  const [showPass, setShowPass] = useState(false);
  const { login, loading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(form.email, form.password);
      navigate("/");
    } catch (err) {
      toast.error(err?.message || "Invalid credentials");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      {/* Background decoration */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -200,
            right: -200,
            width: 600,
            height: 600,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(108,99,255,0.08) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -200,
            left: -200,
            width: 600,
            height: 600,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(34,211,160,0.05) 0%, transparent 70%)",
          }}
        />
      </div>

      <div style={{ width: "100%", maxWidth: 420, position: "relative" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div
            style={{
              width: 60,
              height: 60,
              background: "var(--accent)",
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <Boxes size={30} color="#fff" />
          </div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 28,
              fontWeight: 800,
              color: "var(--text)",
              letterSpacing: "-0.02em",
            }}
          >
            StockFlow
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 4 }}>
            Inventory Management System
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 32 }}>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 20,
              fontWeight: 700,
              marginBottom: 24,
            }}
          >
            Sign In
          </h2>

          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                className="form-input"
                type="email"
                placeholder="admin@stockflow.com"
                value={form.email}
                onChange={(e) =>
                  setForm((p) => ({ ...p, email: e.target.value }))
                }
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: "relative" }}>
                <input
                  className="form-input"
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, password: e.target.value }))
                  }
                  style={{ paddingRight: 40 }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    padding: 2,
                  }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading}
              style={{
                justifyContent: "center",
                marginTop: 8,
                padding: "12px",
              }}
            >
              {loading ? <span className="spinner" /> : "Sign In"}
            </button>
          </form>
        </div>

        <p
          style={{
            textAlign: "center",
            color: "var(--text-dim)",
            fontSize: 12,
            marginTop: 16,
          }}
        >
          StockFlow v2.0 — Multi-Warehouse Inventory System
        </p>
      </div>
    </div>
  );
}
