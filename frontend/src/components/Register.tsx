import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerUser } from "../services/api";
import { useAuth } from "../context/AuthContext";

const Register: React.FC = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      const res = await registerUser(name, email, password);
      login(res.access_token, res.user);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "登録に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-wrapper">
      <div className="auth-form-container">
      <h2 style={{
        textAlign: "center",
        color: "#e6543a",
        fontWeight: 900,
        fontSize: 28,
        marginBottom: 24,
        letterSpacing: 1
      }}>新規登録</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontWeight: 700, color: "#e6543a" }}>お名前<br />
            <input type="text" value={name} onChange={e => setName(e.target.value)} required style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #eee",
              fontSize: 16,
              marginTop: 6,
              background: "#fff"
            }} />
          </label>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontWeight: 700, color: "#e6543a" }}>メールアドレス<br />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #eee",
              fontSize: 16,
              marginTop: 6,
              background: "#fff"
            }} />
          </label>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontWeight: 700, color: "#e6543a" }}>パスワード<br />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid #eee",
              fontSize: 16,
              marginTop: 6,
              background: "#fff"
            }} />
          </label>
        </div>
        {error && <div style={{ color: "#e6543a", marginBottom: 16, textAlign: "center", fontWeight: 700 }}>{error}</div>}
        <button type="submit" disabled={loading} style={{
          width: "100%",
          padding: "12px 0",
          background: "linear-gradient(90deg, #e6543a 0%, #ffb6b6 100%)",
          color: "#fff",
          fontWeight: 900,
          fontSize: 18,
          border: "none",
          borderRadius: 16,
          boxShadow: "0 2px 8px rgba(230,84,58,0.10)",
          cursor: "pointer",
          transition: "background 0.2s"
        }}
        onMouseOver={e => !loading && (e.currentTarget.style.background = "linear-gradient(90deg, #ffb6b6 0%, #e6543a 100%)")}
        onMouseOut={e => !loading && (e.currentTarget.style.background = "linear-gradient(90deg, #e6543a 0%, #ffb6b6 100%)")}
        >{loading ? "登録中..." : "登録"}</button>
      </form>
        <div style={{ marginTop: 24, textAlign: "center", fontSize: 15 }}>
          すでにアカウントをお持ちの方は <a href="/login" style={{ color: "#e6543a", fontWeight: 700, textDecoration: "underline dotted" }}>ログイン</a>
        </div>
      </div>
    </div>
  );
};

export default Register; 