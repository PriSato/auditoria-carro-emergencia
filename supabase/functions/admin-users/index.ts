// Edge Function "admin-users" — gerenciamento de usuários (somente administradores).
//
// O navegador NUNCA recebe a service_role key: ela só existe aqui, no servidor
// do Supabase (variável SUPABASE_SERVICE_ROLE_KEY, já injetada automaticamente).
// Toda chamada exige um usuário logado cujo papel em public.user_roles seja
// 'admin' e esteja ativo.
//
// Ações (POST JSON { action, ... }):
//   list            → lista usuários com nome, papel e situação
//   create          → { email, password, name, role }  cria usuário já confirmado
//   set_role        → { user_id, role }                 muda o papel
//   set_active      → { user_id, active }               ativa/desativa o acesso
//   reset_password  → { user_id, password }             define nova senha
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ROLES = ["admin", "coordenacao"];
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // 1) Quem está chamando?
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: caller, error: callerErr } = await admin.auth.getUser(token);
    if (callerErr || !caller?.user) return json({ error: "Sessão inválida. Entre novamente." }, 401);
    const me = caller.user;

    // 2) É administrador ativo?
    const { data: myRole } = await admin
      .from("user_roles").select("role, active").eq("user_id", me.id).maybeSingle();
    if (!myRole || myRole.role !== "admin" || !myRole.active) {
      return json({ error: "Apenas administradores podem gerenciar usuários." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    // ---------- list ----------
    if (action === "list") {
      const { data: list, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) throw error;
      const { data: roles } = await admin.from("user_roles").select("user_id, role, active");
      const { data: profiles } = await admin.from("profiles").select("id, name");
      const roleBy = new Map((roles || []).map((r) => [r.user_id, r]));
      const nameBy = new Map((profiles || []).map((p) => [p.id, p.name]));
      const users = list.users.map((u) => ({
        id: u.id,
        email: u.email,
        name: nameBy.get(u.id) || (u.user_metadata?.name as string) || "",
        role: roleBy.get(u.id)?.role ?? null,
        active: roleBy.get(u.id)?.active ?? false,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        is_me: u.id === me.id,
      }));
      return json({ users });
    }

    // ---------- create ----------
    if (action === "create") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const name = String(body.name || "").trim();
      const role = String(body.role || "");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "E-mail inválido." }, 400);
      if (password.length < 8) return json({ error: "A senha precisa ter no mínimo 8 caracteres." }, 400);
      if (!ROLES.includes(role)) return json({ error: "Papel inválido." }, 400);

      const { data: created, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { name },
      });
      if (error) {
        const m = (error.message || "").toLowerCase();
        if (m.includes("already") || m.includes("registered")) return json({ error: "Já existe um usuário com este e-mail." }, 409);
        throw error;
      }
      const uid = created.user.id;
      const { error: roleErr } = await admin.from("user_roles").upsert({
        user_id: uid, email, role, active: true, created_by: me.id,
      });
      if (roleErr) {
        await admin.auth.admin.deleteUser(uid); // desfaz: não deixa usuário sem papel
        throw roleErr;
      }
      await admin.from("profiles").upsert({ id: uid, name: name || email.split("@")[0] });
      return json({ ok: true, id: uid });
    }

    // As ações abaixo exigem um usuário-alvo.
    const targetId = String(body.user_id || "");
    if (!targetId) return json({ error: "Usuário não informado." }, 400);
    const isSelf = targetId === me.id;

    // ---------- set_role ----------
    if (action === "set_role") {
      const role = String(body.role || "");
      if (!ROLES.includes(role)) return json({ error: "Papel inválido." }, 400);
      if (isSelf) return json({ error: "Você não pode alterar o seu próprio papel." }, 400);
      const { data: target, error: tErr } = await admin.auth.admin.getUserById(targetId);
      if (tErr || !target?.user) return json({ error: "Usuário não encontrado." }, 404);
      const { error } = await admin.from("user_roles").upsert({
        user_id: targetId, email: target.user.email, role, active: true, created_by: me.id,
      });
      if (error) throw error;
      await admin.auth.admin.updateUserById(targetId, { ban_duration: "none" });
      return json({ ok: true });
    }

    // ---------- set_active ----------
    if (action === "set_active") {
      const active = body.active === true;
      if (isSelf) return json({ error: "Você não pode desativar o seu próprio acesso." }, 400);
      const { data: row } = await admin.from("user_roles").select("user_id").eq("user_id", targetId).maybeSingle();
      if (!row) return json({ error: "Este usuário ainda não tem papel. Defina um papel primeiro." }, 400);
      const { error } = await admin.from("user_roles").update({ active }).eq("user_id", targetId);
      if (error) throw error;
      // Desativado também não consegue mais entrar (sessões atuais perdem acesso aos dados pela RLS).
      await admin.auth.admin.updateUserById(targetId, { ban_duration: active ? "none" : "876000h" });
      return json({ ok: true });
    }

    // ---------- reset_password ----------
    if (action === "reset_password") {
      const password = String(body.password || "");
      if (password.length < 8) return json({ error: "A senha precisa ter no mínimo 8 caracteres." }, 400);
      const { error } = await admin.auth.admin.updateUserById(targetId, { password });
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "Ação desconhecida." }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message || "Erro interno." }, 500);
  }
});
