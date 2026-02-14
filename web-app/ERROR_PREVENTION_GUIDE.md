# 🔒 Error Prevention Guide
**Last Updated**: February 14, 2026  
**Purpose**: Prevent common React/Next.js errors through best practices and tools

---

## 📋 Table of Contents
1. [Recent Error Analysis](#recent-error-analysis)
2. [Prevention Checklist](#prevention-checklist)
3. [Code Review Checklist](#code-review-checklist)
4. [ESLint Configuration](#eslint-configuration)
5. [State Management Best Practices](#state-management-best-practices)
6. [Common Pitfalls & Solutions](#common-pitfalls--solutions)
7. [Testing Strategy](#testing-strategy)

---

## 🚨 Recent Error Analysis

### Error: `studentInfo is not defined`

**Date**: February 14, 2026  
**Location**: `web-app/app/landing/page.js`  
**Severity**: Runtime ReferenceError (Application Crash)

#### What Happened
```javascript
// ❌ BEFORE (BROKEN)
const [loadingInfo, setLoadingInfo] = useState(true);
const [error, setError] = useState(null);
// ⚠️ MISSING: const [studentInfo, setStudentInfo] = useState(null);

// Later in the code:
setStudentInfo(result.data);  // ❌ ReferenceError: setStudentInfo is not defined

// In JSX:
{studentInfo && (  // ❌ ReferenceError: studentInfo is not defined
    <AcademicInfoCard data={studentInfo} loading={loadingInfo} />
)}
```

#### Root Cause
1. **Missing State Declaration**: `studentInfo` and `setStudentInfo` were never declared with `useState`
2. **Component Integration Without Review**: `AcademicInfoCard` was added to the page without verifying state management
3. **No ESLint Enforcement**: Project lacked ESLint configuration to catch undefined variables

#### Impact
- ❌ Application crashes on landing page load
- ❌ User experience completely broken
- ❌ Debugging time wasted (could have been caught earlier)

#### Fix Applied
```javascript
// ✅ AFTER (FIXED)
const [loadingInfo, setLoadingInfo] = useState(true);
const [error, setError] = useState(null);
const [studentInfo, setStudentInfo] = useState(null);  // ✅ ADDED

// Now works correctly:
setStudentInfo(result.data);  // ✅ OK

{studentInfo && (  // ✅ OK
    <AcademicInfoCard data={studentInfo} loading={loadingInfo} />
)}
```

---

## ✅ Prevention Checklist

### Before Writing Code
- [ ] **Understand the Feature**: What data does this component need?
- [ ] **Define State First**: List all `useState` calls before implementing logic
- [ ] **Check Dependencies**: What props, contexts, or APIs does this use?
- [ ] **Plan Data Flow**: How does data move from parent → child?

### During Development
- [ ] **Declare All State**: Never use variables before declaring with `useState`
- [ ] **Use TypeScript**: Add type annotations for all state variables
- [ ] **Run ESLint**: Run `npm run lint` before committing
- [ ] **Test Edge Cases**: What happens when data is `null`, `undefined`, or loading?

### Before Committing
- [ ] **ESLint Pass**: `npm run lint` shows no errors
- [ ] **Manual Test**: Component works in browser
- [ ] **Console Clean**: No errors or warnings in DevTools
- [ ] **Code Review**: Peer review completed (if team)

### Before Production
- [ ] **Build Success**: `npm run build` completes without errors
- [ ] **Test on Multiple Browsers**: Chrome, Firefox, Safari
- [ ] **Test on Mobile**: iOS Safari, Chrome Android
- [ ] **Performance Check**: Lighthouse score > 90

---

## 🔍 Code Review Checklist

### State Management
- [ ] All `useState` declarations are at the top of the component
- [ ] No undefined variables are referenced
- [ ] State setters are only called within event handlers or `useEffect`
- [ ] Loading states are properly defined for async operations

### Component Props
- [ ] All props are defined (either via props parameter or destructuring)
- [ ] Required props are documented
- [ ] Default values provided for optional props
- [ ] PropTypes or TypeScript types are defined

### React Hooks
- [ ] Hooks are called at the top level (not inside loops, conditions, or nested functions)
- [ ] `useEffect` dependency arrays are complete and correct
- [ ] No infinite loops from missing/incorrect dependencies
- [ ] Custom hooks are properly defined and documented

### Error Handling
- [ ] Try-catch blocks around async operations
- [ ] Error state is defined and displayed to users
- [ ] Fallback UI for loading states
- [ ] Console errors are logged with context

### Performance
- [ ] No unnecessary re-renders (use `useMemo`, `useCallback` where needed)
- [ ] Large lists use virtualization or pagination
- [ ] Images are optimized (next/image or lazy loading)
- [ ] Bundle size is reasonable (< 200KB gzipped)

### Accessibility
- [ ] All interactive elements have `role` and `aria` attributes
- [ ] Keyboard navigation works
- [ ] Focus states are visible
- [ ] Color contrast meets WCAG AA standards

---

## ⚙️ ESLint Configuration

### Current Setup
Project uses ESLint with the following configuration (`.eslintrc.json`):

```json
{
  "extends": [
    "next/core-web-vitals",
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "rules": {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "no-undef": "error",  // ✅ THIS WOULD HAVE CAUGHT studentInfo ERROR
    "no-unused-vars": "warn"
  }
}
```

### Running ESLint
```bash
# Check for errors
npm run lint

# Auto-fix issues
npm run lint:fix
```

### Key Rules
| Rule | Level | Purpose |
|------|-------|---------|
| `no-undef` | error | Catches undefined variables (would have prevented our error) |
| `react-hooks/rules-of-hooks` | error | Ensures hooks are used correctly |
| `react-hooks/exhaustive-deps` | warn | Checks useEffect dependencies |
| `no-unused-vars` | warn | Identifies unused variables |

---

## 📦 State Management Best Practices

### 1. Declare State Early
```javascript
// ✅ GOOD - All state at the top
function MyComponent() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  
  // Component logic...
}

// ❌ BAD - State declared later, scattered
function MyComponent() {
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const [data, setData] = useState(null);  // ❌ WRONG - useState in useEffect
  }, []);
}
```

### 2. Use TypeScript for Type Safety
```typescript
// ✅ GOOD - TypeScript interface
interface StudentInfo {
  id: string;
  name: string;
  gpax: string;
  currentacadyear: number;
}

const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);

// ❌ BAD - No type safety
const [studentInfo, setStudentInfo] = useState(null);
```

### 3. Handle Loading and Error States
```javascript
// ✅ GOOD - Complete state management
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/data');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  fetchData();
}, []);

// Render with proper handling
if (loading) return <LoadingSpinner />;
if (error) return <ErrorMessage message={error} />;
return <DataDisplay data={data} />;
```

### 4. Use Context for Global State
```javascript
// ✅ GOOD - Context for shared state
const AuthContext = createContext();

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Auth logic...
  
  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// In components:
const { user, loading } = useAuth();
```

---

## 🐛 Common Pitfalls & Solutions

### Pitfall 1: Undefined State Variables
**Problem**: Using state variables before declaring them
```javascript
// ❌ BEFORE
const [loading, setLoading] = useState(true);
setStudentInfo(data);  // ❌ Error: studentInfo not defined
```

**Solution**: Declare all state first
```javascript
// ✅ AFTER
const [loading, setLoading] = useState(true);
const [studentInfo, setStudentInfo] = useState(null);
setStudentInfo(data);  // ✅ OK
```

### Pitfall 2: Missing Dependencies in useEffect
**Problem**: Infinite loops or stale data
```javascript
// ❌ BEFORE - Missing dependency
useEffect(() => {
  fetchData(studentId);
}, []);  // ⚠️ Missing studentId in dependencies
```

**Solution**: Include all dependencies
```javascript
// ✅ AFTER
useEffect(() => {
  fetchData(studentId);
}, [studentId]);  // ✅ Correct
```

### Pitfall 3: Conditional Hooks
**Problem**: Calling hooks conditionally
```javascript
// ❌ BEFORE - Conditional hook
if (user) {
  const [data, setData] = useState(null);  // ❌ WRONG
}
```

**Solution**: Always call hooks at top level
```javascript
// ✅ AFTER
const [data, setData] = useState(null);

if (user) {
  // Use data only when user exists
  setData(user.data);
}
```

### Pitfall 4: Not Handling Empty States
**Problem**: Component crashes when data is null/undefined
```javascript
// ❌ BEFORE
<div>{user.name}</div>  // ❌ Crashes if user is null
```

**Solution**: Add checks
```javascript
// ✅ AFTER
{user ? (
  <div>{user.name}</div>
) : (
  <div>Loading...</div>
)}
```

---

## 🧪 Testing Strategy

### Unit Tests (Jest + React Testing Library)
```javascript
describe('Landing Page', () => {
  it('should initialize with empty studentInfo', () => {
    render(<Landing />);
    expect(screen.queryByText('Academic Info')).not.toBeInTheDocument();
  });
  
  it('should render AcademicInfoCard after data fetch', async () => {
    const mockData = { gpax: '3.24', currentacadyear: '2566' };
    jest.spyOn(global, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: mockData })
    });
    
    render(<Landing />);
    await waitFor(() => {
      expect(screen.getByText('ข้อมูลการศึกษา')).toBeInTheDocument();
    });
  });
});
```

### Integration Tests
- Test complete user flows (login → landing → grade page)
- Test error scenarios (network failure, session timeout)
- Test with different user roles (student, instructor, admin)

### E2E Tests (Playwright/Cypress)
- Test real browser behavior
- Test mobile responsiveness
- Test accessibility with screen readers

---

## 📚 Resources

### Official Documentation
- [React Hooks Rules](https://react.dev/reference/react)
- [Next.js Best Practices](https://nextjs.org/docs)
- [ESLint Documentation](https://eslint.org/docs/latest/)

### Tools
- [ESLint](https://eslint.org/) - Code quality
- [Prettier](https://prettier.io/) - Code formatting
- [Jest](https://jestjs.io/) - Unit testing
- [React Testing Library](https://testing-library.com/react) - Component testing

### Articles
- [Common React Mistakes](https://reactpatterns.com/)
- [React Performance Optimization](https://react.dev/learn/render-and-commit)
- [State Management Patterns](https://kentcdodds.com/blog/application-state-management-with-react)

---

## 🎯 Quick Reference

### State Declaration Template
```javascript
function MyComponent() {
  // 1. Define all state at the top
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 2. Define effects
  useEffect(() => {
    // Async logic here
  }, [dependencies]);
  
  // 3. Define handlers
  const handleClick = () => {
    // Event handling here
  };
  
  // 4. Render
  if (loading) return <Loading />;
  if (error) return <ErrorDisplay error={error} />;
  return <MainDisplay data={data} />;
}
```

### ESLint Commands
```bash
# Check for errors
npm run lint

# Auto-fix issues
npm run lint:fix

# Check specific file
npx eslint app/landing/page.js
```

---

## 📞 Getting Help

If you encounter errors:
1. **Check the console** - Read the full error message
2. **Run ESLint** - `npm run lint` to catch issues early
3. **Review this guide** - Check for common pitfalls
4. **Search documentation** - React/Next.js official docs
5. **Ask team** - Code review and pair programming

---

**Remember**: Prevention is better than cure. Use ESLint, write tests, and follow best practices to catch errors before they reach production.

**Last Review**: February 14, 2026  
**Next Review**: After Phase 5b completion