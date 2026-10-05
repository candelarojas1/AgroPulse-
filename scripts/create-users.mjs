// Crea los usuarios de prueba y sus membresías en Supabase.
// Uso (desde la raíz del repo): node --env-file=.env scripts/create-users.mjs
// Requiere haber ejecutado antes las migraciones y la semilla.
// Se puede volver a ejecutar: si el usuario ya existe, solo actualiza sus membresías.

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TEST_USERS_PASSWORD } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !TEST_USERS_PASSWORD) {
  console.error('Faltan SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o TEST_USERS_PASSWORD en .env');
  process.exit(1);
}

const ESTANCIA = '11111111-1111-1111-1111-111111111111';
const PARAJE_DEMO = '22222222-2222-2222-2222-222222222222';

const USERS = [
  // El productor pertenece a dos establecimientos para mostrar el selector (RF-03).
  { email: 'productor@agropulse.test', memberships: [[ESTANCIA, 'producer'], [PARAJE_DEMO, 'producer']] },
  { email: 'operador@agropulse.test', memberships: [[ESTANCIA, 'operator']] },
  { email: 'asesor@agropulse.test', memberships: [[ESTANCIA, 'advisor']] },
  // Usuario de otro establecimiento: no debe ver los lotes de la Estancia (RF-02).
  { email: 'otro@agropulse.test', memberships: [[PARAJE_DEMO, 'producer']] },
];

const headers = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

async function findUserId(email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, { headers });
  const { users } = await res.json();
  return users.find((u) => u.email === email)?.id;
}

async function ensureUser(email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password: TEST_USERS_PASSWORD, email_confirm: true }),
  });
  if (res.ok) {
    return { id: (await res.json()).id, created: true };
  }
  const existingId = res.status === 422 ? await findUserId(email) : undefined;
  if (existingId) {
    return { id: existingId, created: false };
  }
  throw new Error(`No se pudo crear ${email}: ${res.status} ${await res.text()}`);
}

async function upsertMemberships(userId, memberships) {
  const rows = memberships.map(([organization_id, role]) => ({ user_id: userId, organization_id, role }));
  const res = await fetch(`${SUPABASE_URL}/rest/v1/memberships`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    throw new Error(`No se pudieron guardar las membresías: ${res.status} ${await res.text()}`);
  }
}

for (const { email, memberships } of USERS) {
  const { id, created } = await ensureUser(email);
  await upsertMemberships(id, memberships);
  const roles = memberships.map(([, role]) => role).join(', ');
  console.log(`${created ? 'creado   ' : 'existente'} ${email} (${roles})`);
}
