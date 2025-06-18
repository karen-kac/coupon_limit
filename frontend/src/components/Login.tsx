import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser } from "../services/api";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await loginUser(email, password);
      localStorage.setItem("token", res.access_token);
      navigate("/");
    } catch (err: any) {
      setError(err?.response?.data?.detail || "ログインに失敗しました");
    }
  };

  return (
    <div style={{
      maxWidth: 360,
      margin: "48px auto",
      padding: 32,
      borderRadius: 24,
      background: "#FFF9EC",
      boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
      fontFamily: "'Rounded Mplus 1c', 'Arial Rounded MT Bold', 'Arial', sans-serif"
    }}>
      <h2 style={{
        textAlign: "center",
        color: "#e6543a",
        fontWeight: 900,
        fontSize: 28,
        marginBottom: 24,
        letterSpacing: 1
      }}>ログイン</h2>
      <form onSubmit={handleSubmit}>
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
        <button type="submit" style={{
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
        onMouseOver={e => (e.currentTarget.style.background = "linear-gradient(90deg, #ffb6b6 0%, #e6543a 100%)")}
        onMouseOut={e => (e.currentTarget.style.background = "linear-gradient(90deg, #e6543a 0%, #ffb6b6 100%)")}
        >ログイン</button>
      </form>
      <div style={{ marginTop: 24, textAlign: "center", fontSize: 15 }}>
        アカウントをお持ちでない方は <a href="/register" style={{ color: "#e6543a", fontWeight: 700, textDecoration: "underline dotted" }}>新規登録</a>
      </div>
    </div>
  );
};

export default Login; 