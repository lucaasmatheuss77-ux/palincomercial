
const BASE_URL = 'http://localhost:3001';

async function testRoute(path) {
  try {
    const res = await fetch(`${BASE_URL}${path}`, { method: 'HEAD' });
    console.log(`[${res.status}] ${path}`);
    return res.status === 200 || res.status === 307 || res.status === 302;
  } catch (err) {
    console.error(`[FAIL] ${path}:`, err.message);
    return false;
  }
}

async function runTests() {
  console.log('--- Iniciando Smoke Test ---');
  const routes = [
    '/login',
    '/dashboard',
    '/dashboard/pipeline',
    '/dashboard/mobile-crm',
    '/api/health'
  ];

  for (const route of routes) {
    await testRoute(route);
  }
  console.log('--- Smoke Test Concluído ---');
}

runTests();
