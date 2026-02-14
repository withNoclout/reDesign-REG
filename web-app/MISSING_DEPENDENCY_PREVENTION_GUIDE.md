# Missing Dependency Error Prevention Guide

## Error Type
**Module not found: Can't resolve '[package-name]'**

## Common Causes
1. **Forgot to install required package** after importing it in code
2. **Package not listed in package.json** dependencies
3. **Typos in package name** in import statement
4. **Installing in wrong directory** (not in project root)
5. **Node modules not installed** after cloning repo

## Prevention Checklist

### Before Importing Any Package
- [ ] Check if package is already installed: `npm list [package-name]`
- [ ] Search for the correct package name on npmjs.com
- [ ] Verify spelling matches exactly (case-sensitive)
- [ ] Check package documentation for exact import syntax

### When Installing Packages
- [ ] Run from project root directory (where package.json exists)
- [ ] Use correct npm command: `npm install [package-name]`
- [ ] For production dependencies: `npm install --save [package-name]` (default)
- [ ] For dev dependencies: `npm install --save-dev [package-name]`
- [ ] Wait for installation to complete before proceeding

### After Installing
- [ ] Verify package appears in package.json dependencies
- [ ] Check node_modules folder contains the package
- [ ] Test the import in your code

## Quick Reference: Common Dependencies

### Authentication & Security
```bash
npm install jsonwebtoken          # JWT token handling
npm install bcrypt               # Password hashing
npm install cookie                # Cookie parsing
```

### API & Data
```bash
npm install axios                # HTTP client
npm install node-fetch            # Fetch polyfill
npm install form-data            # Form data handling
```

### Database
```bash
npm install mongoose              # MongoDB
npm install pg                   # PostgreSQL
npm install mysql                # MySQL
```

### Utilities
```bash
npm install date-fns             # Date formatting
npm install lodash               # Utility functions
npm install clsx                 # CSS class merging
npm install uuid                 # Unique ID generation
```

## Troubleshooting Steps

### Step 1: Verify Package Existence
```bash
# Check if package is installed
npm list [package-name]

# Example:
npm list jsonwebtoken
```

### Step 2: Install Missing Package
```bash
# Install missing package
npm install [package-name]

# With specific version
npm install [package-name]@[version]

# Example:
npm install jsonwebtoken@9.0.0
```

### Step 3: Clear Cache (if needed)
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Step 4: Check Import Path
```javascript
// Correct import (use npm package name)
import jwt from 'jsonwebtoken';

// INCORRECT (relative path for npm packages)
import jwt from './node_modules/jsonwebtoken';
```

## Best Practices

### 1. Install All Dependencies at Once
```bash
# Instead of installing one by one
npm install jsonwebtoken bcrypt cookie

# Read from package.json
npm install
```

### 2. Use package.json as Source of Truth
```json
{
  "dependencies": {
    "jsonwebtoken": "^9.0.0",
    "bcrypt": "^5.1.0",
    "next": "^14.0.0"
  }
}
```

### 3. Document External Dependencies
Create a `DEPENDENCIES.md` file:
```markdown
## External Dependencies
- jsonwebtoken: JWT token generation and verification
- bcrypt: Password hashing and comparison
- framer-motion: UI animations
```

### 4. Version Pinning for Production
```bash
# Pin specific versions to avoid breaking changes
npm install jsonwebtoken@9.0.0 --save-exact
```

### 5. Dependency Audit
```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities automatically
npm audit fix
```

## Error Prevention Workflow

### Before Starting New Feature
1. Identify all required packages
2. Check which are already installed
3. Install missing packages: `npm install [package]`
4. Verify installation: `npm list [package]`
5. Test import in code
6. Run build: `npm run build`

### When Cloning Repository
```bash
# Always run this first
npm install

# Or with specific package manager
yarn install
pnpm install
```

### Before Deploying
```bash
# Ensure all dependencies are installed
npm install

# Check for vulnerabilities
npm audit

# Run production build
npm run build
```

## Common Scenarios & Solutions

### Scenario 1: Import Statement Error
```
Error: Module not found: Can't resolve 'jsonwebtoken'
```
**Solution:**
```bash
npm install jsonwebtoken
```

### Scenario 2: Wrong Package Name
```
Error: Module not found: Can't resolve 'jwt' (should be 'jsonwebtoken')
```
**Solution:**
```bash
# Search for correct name
npm search jwt
# Or check npmjs.com
```

### Scenario 3: Development Dependency
```
Error: Module not found: Can't resolve 'eslint'
```
**Solution:**
```bash
npm install --save-dev eslint
```

### Scenario 4: TypeScript Error
```
Error: Cannot find module 'jsonwebtoken' or its corresponding type declarations
```
**Solution:**
```bash
npm install jsonwebtoken @types/jsonwebtoken
```

## Automation Scripts

### Pre-commit Check (package.json)
```json
{
  "scripts": {
    "precommit": "npm run check-deps",
    "check-deps": "node scripts/check-deps.js"
  }
}
```

### Dependency Checker Script (scripts/check-deps.js)
```javascript
const fs = require('fs');
const { execSync } = require('child_process');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const dependencies = Object.keys(packageJson.dependencies || {});
const devDependencies = Object.keys(packageJson.devDependencies || {});

console.log('Checking dependencies...');
dependencies.forEach(dep => {
  try {
    execSync(`npm list ${dep}`, { stdio: 'pipe' });
  } catch (error) {
    console.error(`❌ Missing dependency: ${dep}`);
    console.log(`   Run: npm install ${dep}`);
    process.exit(1);
  }
});

console.log('✅ All dependencies are installed!');
```

## Monitoring & Alerts

### CI/CD Integration
```yaml
# .github/workflows/dependency-check.yml
name: Dependency Check
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install dependencies
        run: npm install
      - name: Check dependencies
        run: npm list --depth=0
```

### Pre-build Hook
```javascript
// next.config.js
const { execSync } = require('child_process');

module.exports = {
  webpack: (config) => {
    // Check dependencies before build
    try {
      execSync('npm list --depth=0');
    } catch (error) {
      console.error('❌ Some dependencies are missing!');
      console.error('Run: npm install');
      process.exit(1);
    }
    return config;
  }
};
```

## Checklist for Team Members

### Before Committing
- [ ] Run `npm install` to ensure all deps are installed
- [ ] Run `npm run build` to verify no missing modules
- [ ] Check `npm list` for any missing packages
- [ ] Update package.json if new dependencies added

### Before Code Review
- [ ] Review new dependencies in package.json
- [ ] Verify dependencies are necessary
- [ ] Check for security vulnerabilities: `npm audit`
- [ ] Ensure version constraints are appropriate

### Before Merge
- [ ] Run full build: `npm run build`
- [ ] Run tests: `npm test`
- [ ] Check for breaking changes in dependencies
- [ ] Update lock file (package-lock.json)

## Related Documentation
- npm documentation: https://docs.npmjs.com/
- package.json reference: https://docs.npmjs.com/files/package.json
- npm install guide: https://docs.npmjs.com/cli/v9/commands/npm-install

## Summary
**Key Takeaways:**
1. Always check `npm list` before importing new packages
2. Install dependencies from project root directory
3. Use package.json as source of truth
4. Pin versions for production stability
5. Run `npm audit` regularly for security
6. Document external dependencies
7. Automate dependency checks in CI/CD

**Follow this guide to prevent "Module not found" errors!**