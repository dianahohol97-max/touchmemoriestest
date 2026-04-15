'use client';

/**
 * SizeVisualizer — renders mini visual mockups for size options.
 * Parses size strings like "20x30", "10×15 см", "A4", "5x7.5" and draws
 * proportional rectangles so the customer can compare sizes at a glance.
 *
 * Click a visual to select the size.
 */

interface SizeVisualizerProps {
  sizes: (string | number)[];
  selected: string | number | null;
  onSelect: (size: string) => void;
  prices?: Record<string, number>;
  productCategory?: 'paper' | 'book' | 'magnet' | 'print' | 'puzzle' | 'poster' | 'generic';
}

// Parse size string into width × height cm
// Supports: "20x30", "20×30", "20x30 см", "A4", "A5", "5x7.5", "30x20 см"
function parseSize(s: string | number): { w: number; h: number; label: string } | null {
  const str = String(s).trim();

  // Standard paper sizes
  const papers: Record<string, { w: number; h: number }> = {
    'a6': { w: 10.5, h: 14.8 },
    'a5': { w: 14.8, h: 21.0 },
    'a4': { w: 21.0, h: 29.7 },
    'a3': { w: 29.7, h: 42.0 },
    'a2': { w: 42.0, h: 59.4 },
    'a1': { w: 59.4, h: 84.1 },
  };
  const lower = str.toLowerCase();
  for (const [k, v] of Object.entries(papers)) {
    if (lower === k || lower.startsWith(k + ' ') || lower.startsWith(k + '-')) {
      return { ...v, label: str };
    }
  }

  // Try to parse "W×H" / "WxH" / "WхH" patterns
  const match = str.match(/(\d+(?:[.,]\d+)?)\s*[×xх]\s*(\d+(?:[.,]\d+)?)/i);
  if (match) {
    const w = parseFloat(match[1].replace(',', '.'));
    const h = parseFloat(match[2].replace(',', '.'));
    if (w > 0 && h > 0) return { w, h, label: str };
  }

  return null;
}

export function SizeVisualizer({ sizes, selected, onSelect, prices, productCategory = 'generic' }: SizeVisualizerProps) {
  // Parse all sizes and find max dimensions for consistent scaling
  const parsed = sizes
    .map(s => ({ raw: String(s), data: parseSize(s) }))
    .filter(p => p.data !== null);

  if (parsed.length === 0) return null; // No parseable sizes — skip visualization

  // Find the largest dimension across all sizes for proportional scaling
  const maxDim = Math.max(...parsed.map(p => Math.max(p.data!.w, p.data!.h)));
  // Max visual box size in px — smaller so more items fit in one row
  const maxPx = 64;
  const scale = maxPx / maxDim;

  // Style differs by category: books get thick border, prints thin, posters neutral
  const borderStyle = (isActive: boolean) => ({
    border: isActive ? '2.5px solid #1e2d7d' : '1.5px solid #cbd5e1',
    background: isActive ? '#f0f3ff' : '#ffffff',
    boxShadow: isActive ? '0 2px 8px rgba(30,45,125,0.15)' : '0 1px 2px rgba(0,0,0,0.04)',
  });

  return (
    <div>
      <div style={{
        display: 'flex',
        flexWrap: 'nowrap',
        gap: 10,
        padding: '10px 0 8px',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}>
        {parsed.map(({ raw, data }) => {
          const d = data!;
          const w = d.w * scale;
          const h = d.h * scale;
          const isActive = String(selected) === raw;
          const price = prices?.[raw];

          return (
            <button
              key={raw}
              type="button"
              onClick={() => onSelect(raw)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                background: 'transparent',
                border: 'none',
                padding: 4,
                cursor: 'pointer',
                minWidth: maxPx + 8,
                outline: 'none',
              }}
            >
              {/* Visual rectangle */}
              <div
                style={{
                  width: maxPx,
                  height: maxPx,
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  paddingBottom: 2,
                }}
              >
                <div
                  style={{
                    width: Math.max(w, 8),
                    height: Math.max(h, 8),
                    borderRadius: 2,
                    transition: 'all 0.15s ease',
                    position: 'relative',
                    ...borderStyle(isActive),
                  }}
                >
                  {/* Width label on top */}
                  <div style={{
                    position: 'absolute',
                    top: -18,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 9,
                    color: isActive ? '#1e2d7d' : '#94a3b8',
                    whiteSpace: 'nowrap',
                    fontWeight: 600,
                  }}>
                    {d.w} см
                  </div>
                  {/* Height label on right */}
                  <div style={{
                    position: 'absolute',
                    right: -22,
                    top: '50%',
                    transform: 'translateY(-50%) rotate(-90deg)',
                    transformOrigin: 'center',
                    fontSize: 9,
                    color: isActive ? '#1e2d7d' : '#94a3b8',
                    whiteSpace: 'nowrap',
                    fontWeight: 600,
                  }}>
                    {d.h} см
                  </div>
                </div>
              </div>
              {/* Size name + price */}
              <div style={{
                fontSize: 12,
                fontWeight: isActive ? 800 : 600,
                color: isActive ? '#1e2d7d' : '#475569',
                textAlign: 'center',
                lineHeight: 1.2,
              }}>
                {raw}
              </div>
              {price !== undefined && (
                <div style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: isActive ? '#1e2d7d' : '#94a3b8',
                }}>
                  {price} ₴
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
