# Touch.Memories Button Design System

## Unified Button Specifications

### Primary CTA Button
**Usage:** Main actions like "Відкрити конструктор", "Детальніше", "Замовити"

**Tailwind Classes:**
```tsx
className="bg-[#1e2d7d] text-white font-bold px-7 py-3.5 rounded-lg hover:bg-[#152158] transition-colors duration-200"
```

**Inline Styles:**
```tsx
style={{
  backgroundColor: '#1e2d7d',
  color: 'white',
  padding: '14px 28px',
  borderRadius: '8px',
  fontWeight: 700,
  border: 'none',
  cursor: 'pointer',
  transition: 'background-color 0.2s'
}}
```

**Hover State:** `#152158` (darker blue)

**Text Style:** Sentence case (NOT uppercase)
- ✅ "Відкрити конструктор"
- ❌ "ВІДКРИТИ КОНСТРУКТОР"

---

### Secondary/Outline Button
**Usage:** Alternative actions, secondary CTAs

**Tailwind Classes:**
```tsx
className="border-2 border-[#1e2d7d] text-[#1e2d7d] bg-transparent font-bold px-7 py-3.5 rounded-lg hover:bg-[#1e2d7d] hover:text-white transition-all duration-200"
```

**Inline Styles:**
```tsx
style={{
  border: '2px solid #1e2d7d',
  color: '#1e2d7d',
  backgroundColor: 'transparent',
  padding: '14px 28px',
  borderRadius: '8px',
  fontWeight: 700,
  cursor: 'pointer',
  transition: 'all 0.2s'
}}
```

**Hover State:** Background fills with `#1e2d7d`, text becomes white

---

### Text Links (Arrow Links)
**Usage:** "Замовити →", "Читати статтю →", "Дізнатись більше →"

**Tailwind Classes:**
```tsx
className="text-[#1e2d7d] font-semibold hover:text-[#152158] transition-colors duration-200 inline-flex items-center gap-2"
```

**Color:** `#1e2d7d`
**Hover:** `#152158` (darker shade)
**Font Weight:** 600 (semibold)

---

## Migration Notes

### ❌ Remove These Styles:
- `rounded-full` (pill buttons)
- `bg-[#263a99]` (old brand color)
- Mixed `rounded-md` and `rounded-full` combinations
- Uppercase text on buttons (use sentence case)

### ✅ Use Instead:
- `rounded-lg` (8px border radius) - consistent across all buttons
- `bg-[#1e2d7d]` (new primary color)
- Sentence case for button text
- Consistent padding: `px-7 py-3.5` (14px 28px)

---

## Examples

### Before:
```tsx
<button className="bg-[#263a99] text-white rounded-full px-6 py-3 uppercase">
  ВІДКРИТИ КОНСТРУКТОР
</button>
```

### After:
```tsx
<button className="bg-[#1e2d7d] text-white font-bold px-7 py-3.5 rounded-lg hover:bg-[#152158] transition-colors duration-200">
  Відкрити конструктор
</button>
```
