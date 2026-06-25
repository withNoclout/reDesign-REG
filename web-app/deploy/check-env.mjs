const required = [
  'NODE_ENV',
  'PORT',
  'NEXT_PUBLIC_BASE_URL',
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET',
  'ENCRYPT_SECRET_KEY',
  'ADMIN_USER_ID',
  'NEXT_PUBLIC_ADMIN_USER_ID'
];

const invalidMarkers = ['replace-with-', 'change-me'];
const missing = [];

for (const key of required) {
  const rawValue = process.env[key];
  const value = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!value) {
    missing.push(`${key}: missing`);
    continue;
  }
  if (invalidMarkers.some(marker => value.includes(marker))) {
    missing.push(`${key}: placeholder`);
  }
}

if (process.env.PORT && process.env.PORT !== '3333') {
  missing.push('PORT: must be 3333');
}

if (process.env.NEXT_PUBLIC_BASE_URL && process.env.NEXT_PUBLIC_BASE_URL !== 'https://redesign-reg.kmutnb.ac.th') {
  missing.push('NEXT_PUBLIC_BASE_URL: must be https://redesign-reg.kmutnb.ac.th');
}


const optionalSsoKeys = [
  'KMUTNB_SSO_CLIENT_ID',
  'KMUTNB_SSO_CLIENT_SECRET',
  'KMUTNB_SSO_REDIRECT_URI',
  'KMUTNB_SSO_TOKEN_ENCRYPTION_KEY'
];

const hasAnySsoConfig = optionalSsoKeys.some((key) => {
  const value = process.env[key];
  return typeof value === 'string' && value.trim();
});

if (hasAnySsoConfig) {
  for (const key of optionalSsoKeys) {
    const rawValue = process.env[key];
    const value = typeof rawValue === 'string' ? rawValue.trim() : '';
    if (!value) {
      missing.push(`${key}: missing`);
      continue;
    }
    if (invalidMarkers.some(marker => value.includes(marker))) {
      missing.push(`${key}: placeholder`);
    }
  }

  if (process.env.KMUTNB_SSO_REDIRECT_URI && process.env.KMUTNB_SSO_REDIRECT_URI !== 'https://redesign-reg.kmutnb.ac.th/api/auth/sso/callback') {
    missing.push('KMUTNB_SSO_REDIRECT_URI: must be https://redesign-reg.kmutnb.ac.th/api/auth/sso/callback');
  }
}

if (missing.length > 0) {
  console.error('Invalid production environment:');
  for (const item of missing) {
    console.error(` - ${item}`);
  }
  process.exit(1);
}
