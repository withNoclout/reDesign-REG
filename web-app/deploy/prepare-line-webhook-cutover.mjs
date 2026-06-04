import crypto from 'node:crypto';

const DEFAULT_BASE_URL = 'https://research.kmutnb.ac.th';
const DEFAULT_PATH_PREFIX = '/line-callbacks/redesign-reg';
const DEFAULT_PROXY_SECRET_HEADER = 'x-reg-line-webhook-proxy-secret';

function parseArgs(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    pathPrefix: DEFAULT_PATH_PREFIX,
    pathToken: null,
    proxySharedSecret: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--base-url':
        options.baseUrl = argv[++index];
        break;
      case '--path-prefix':
        options.pathPrefix = argv[++index];
        break;
      case '--path-token':
        options.pathToken = argv[++index];
        break;
      case '--proxy-secret':
        options.proxySharedSecret = argv[++index];
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function normalizePathPrefix(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new Error('Path prefix is required');
  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return withLeadingSlash.replace(/\/+$/, '');
}

function normalizeBaseUrl(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new Error('Base URL is required');
  const url = new URL(normalized);
  if (url.protocol !== 'https:') throw new Error('Base URL must use HTTPS');
  url.pathname = url.pathname.replace(/\/+$/, '');
  url.search = '';
  url.hash = '';
  return url;
}

function generatePathToken() {
  return crypto.randomBytes(18).toString('base64url');
}

function generateProxySharedSecret() {
  return crypto.randomBytes(32).toString('base64url');
}

function createOutput(options) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const pathPrefix = normalizePathPrefix(options.pathPrefix);
  const pathToken = options.pathToken || generatePathToken();
  const proxySharedSecret = options.proxySharedSecret || generateProxySharedSecret();
  const locationPath = `${pathPrefix}/${pathToken}/webhook`;
  const webhookUrl = new URL(locationPath, `${baseUrl.origin}/`).toString();

  return {
    webhookUrl,
    locationPath,
    pathToken,
    proxySharedSecret,
    proxySecretHeader: DEFAULT_PROXY_SECRET_HEADER,
    env: {
      LINE_WEBHOOK_PUBLIC_URL: webhookUrl,
      LINE_WEBHOOK_PROXY_SHARED_SECRET: proxySharedSecret,
    },
  };
}

const output = createOutput(parseArgs(process.argv.slice(2)));
console.log(JSON.stringify(output, null, 2));
console.log('');
console.log('# env snippet');
console.log(`LINE_WEBHOOK_PUBLIC_URL=${output.env.LINE_WEBHOOK_PUBLIC_URL}`);
console.log(`LINE_WEBHOOK_PROXY_SHARED_SECRET=${output.env.LINE_WEBHOOK_PROXY_SHARED_SECRET}`);
console.log('');
console.log('# openresty placeholders');
console.log(`__LINE_WEBHOOK_PATH_TOKEN__=${output.pathToken}`);
console.log(`__LINE_WEBHOOK_PROXY_SHARED_SECRET__=${output.proxySharedSecret}`);
