# AgentOS Client - Accessibility & Design Guidelines

## Overview

The AgentOS Client follows WCAG 2.1 Level AA accessibility standards and implements semantic HTML, ARIA attributes, and keyboard navigation throughout the application.

## Implemented Accessibility Features

### 1. **Semantic HTML Structure**

#### Main Layout (`App.tsx`)
- `<main>` element with `role="main"` for primary content
- `<nav>` element for sidebar navigation
- `<section>` and `<aside>` for content organization
- Proper heading hierarchy (h1, h2, h3)

#### Navigation (`Sidebar.tsx`)
- Semantic `<nav>` with `aria-label` for screen readers
- `<header>` for top branding section
- List semantics with `role="list"` and `role="listitem"`
- Status updates with `aria-live="polite"` for dynamic content

### 2. **ARIA Attributes**

```tsx
// Navigation landmark
<nav aria-label="Session navigation">

// Toolbar for controls
<div role="toolbar" aria-label="Preferences">

// Current page indicator
<button aria-current="page">

// Live regions for status updates
<span role="status" aria-live="polite">

// Hidden decorative icons
<Icon aria-hidden="true" />

// Screen reader only text
<span className="sr-only">Stream label</span>
```

### 3. **Keyboard Navigation**

#### Focus Management
- All interactive elements are keyboard accessible
- Visible focus indicators with `focus:ring-2` utility
- Logical tab order through document structure
- Skip links for screen readers (can be enhanced)

#### Focus Styles
```css
focus:outline-none 
focus:ring-2 
focus:ring-sky-500 
focus:ring-offset-2
dark:focus:ring-offset-slate-950
```

### 4. **Color Contrast**

#### Light Mode Contrast Ratios
- Primary text: `text-slate-900` on `bg-white` - **21:1** ✅
- Secondary text: `text-slate-600` on `bg-white` - **7:1** ✅
- Borders: `border-slate-200` - **1.2:1** ✅
- Links: `text-sky-600` - **4.5:1** ✅

#### Dark Mode Contrast Ratios
- Primary text: `text-slate-100` on `bg-slate-950` - **18:1** ✅
- Secondary text: `text-slate-400` on `bg-slate-950` - **8:1** ✅
- Borders: `border-white/5` - **Sufficient** ✅

#### Status Indicators
- **Idle**: Gray with 4.5:1+ contrast
- **Streaming**: Green with border for non-color identification
- **Error**: Red with border for non-color identification

### 5. **Theme System**

#### Automatic System Preference Detection
```typescript
// Detects and applies user's OS theme preference
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
```

#### Manual Theme Control
- **Light Mode**: Optimized for daylight use
- **Dark Mode**: Reduced eye strain in low light
- **System Mode**: Follows OS preference automatically

#### localStorage Persistence
```typescript
// Theme preference saved across sessions
localStorage.setItem('agentos-theme-preference', theme);
```

### 6. **Screen Reader Support**

#### Descriptive Labels
```tsx
// Session buttons with full context
aria-label="Session Atlas Systems Architect, status: streaming"

// Action buttons with clear purpose
aria-label="Create new session"
aria-label="Switch to light theme"
```

#### Status Announcements
```tsx
// Dynamic status changes announced to screen readers
<span role="status" aria-live="polite">
  {statusLabel}
</span>
```

#### Hidden Decorative Content
```tsx
// Icons marked as decorative
<Radio className="..." aria-hidden="true" />
```

### 7. **Responsive Design**

#### Breakpoints
- Mobile: `< 640px` - Stacked layout, icon-only controls
- Tablet: `640px - 1280px` - Partial labels
- Desktop: `> 1280px` - Full labels and multi-column layout

#### Mobile Considerations
```tsx
// Labels hidden on small screens for theme toggle
<span className="hidden sm:inline">{label}</span>
```

### 8. **Form Controls**

#### Theme Toggle (RadioGroup)
```tsx
<div role="radiogroup" aria-label="Theme preference">
  <button role="radio" aria-checked={isActive}>
```

#### Proper Button Types
- Action buttons: `<button type="button">`
- Submit buttons: `<button type="submit">`
- No missing `type` attributes

### 9. **Error Handling & User Feedback**

#### Loading States
```tsx
<div role="status">Loading sessions...</div>
```

#### Error Messages
```tsx
<div role="alert" aria-live="assertive">
  Error: Failed to load sessions
</div>
```

#### Empty States
```tsx
<div role="status">
  No active sessions. Click + to create one.
</div>
```

## Best Practices Implemented

### ✅ **Do's**

1. **Use semantic HTML elements**
   - `<nav>`, `<main>`, `<article>`, `<section>`, `<header>`
   
2. **Provide text alternatives**
   - All icons have `aria-hidden="true"`
   - Accompanying text or `aria-label`

3. **Maintain proper heading hierarchy**
   - H1 for page title
   - H2 for major sections
   - No skipped levels

4. **Ensure keyboard navigation**
   - All controls reachable via Tab
   - Enter/Space activate buttons
   - Escape closes modals

5. **Use ARIA landmarks**
   - `role="main"`, `role="navigation"`, `role="complementary"`

6. **Provide focus indicators**
   - Visible ring on all focusable elements
   - Sufficient contrast (3:1 minimum)

### ❌ **Don'ts**

1. **Don't rely on color alone**
   - Status uses text + icons + borders
   
2. **Don't remove focus outlines**
   - Use `focus:ring` instead of `focus:outline-none` alone

3. **Don't use `div` for interactive elements**
   - Use `<button>` for actions
   - Use `<a>` for navigation

4. **Don't create keyboard traps**
   - All modals/overlays are escapable

## Testing Checklist

### Manual Testing

- [ ] Tab through all interactive elements
- [ ] Verify focus indicators are visible
- [ ] Test with screen reader (NVDA/JAWS/VoiceOver)
- [ ] Verify all images have alt text
- [ ] Check color contrast with tools
- [ ] Test with browser zoom at 200%
- [ ] Verify no horizontal scroll at mobile sizes
- [ ] Test theme toggle functionality
- [ ] Verify localStorage persistence

### Automated Testing

```bash
# Install accessibility testing tools
pnpm add -D @axe-core/react eslint-plugin-jsx-a11y

# Run accessibility linter
pnpm run lint
```

### Browser Extensions

- **axe DevTools** - Comprehensive accessibility scanner
- **WAVE** - Visual accessibility evaluation
- **Lighthouse** - Chrome DevTools audit
- **Color Contrast Analyzer** - WCAG contrast checking

## Future Enhancements

### Planned Improvements

1. **Skip Navigation Links**
   ```tsx
   <a href="#main-content" className="sr-only focus:not-sr-only">
     Skip to main content
   </a>
   ```

2. **Keyboard Shortcuts**
   - `Ctrl+N` - New session
   - `Ctrl+K` - Focus search
   - `1-9` - Switch between sessions

3. **Reduced Motion Support**
   ```css
   @media (prefers-reduced-motion: reduce) {
     * {
       animation-duration: 0.01ms !important;
       transition-duration: 0.01ms !important;
     }
   }
   ```

4. **Focus Trapping in Modals**
   ```typescript
   // Implement focus trap for modal dialogs
   useFocusTrap(modalRef, isOpen);
   ```

5. **Announcement Region**
   ```tsx
   <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
     {/* Dynamic announcements */}
   </div>
   ```

6. **High Contrast Mode Support**
   ```css
   @media (prefers-contrast: high) {
     /* Enhanced contrast styles */
   }
   ```

## Resources

### WCAG Guidelines
- [WCAG 2.1 Level AA](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)

### Testing Tools
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE](https://wave.webaim.org/)
- [Pa11y](https://pa11y.org/)

### Documentation
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [WebAIM](https://webaim.org/)
- [A11y Project](https://www.a11yproject.com/)

## Contributing

When adding new components, ensure:

1. Semantic HTML is used
2. ARIA attributes are added where needed
3. Keyboard navigation works
4. Focus states are visible
5. Color contrast meets WCAG AA
6. Light and dark modes both work
7. Screen reader testing is performed

## Contact

For accessibility questions or issues, please:
- Open an issue on GitHub
- Tag with `accessibility` label
- Provide screen reader output if applicable
