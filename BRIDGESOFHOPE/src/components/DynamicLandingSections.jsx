import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

/**
 * Renders CMS “custom blocks” on the public landing page (tables, columns, extra copy).
 * Content is admin-controlled plain text — avoid raw HTML for safety.
 */

const SPACING_MARGIN = {
  tight: 'clamp(0.5rem, 1.5vw, 1rem)',
  normal: 'clamp(0.75rem, 2vw, 1.35rem)',
  loose: 'clamp(1.25rem, 3vw, 2rem)',
};

const WIDTH_STYLE = {
  full: { maxWidth: '100%', marginLeft: 0, marginRight: 0 },
  narrow: { maxWidth: 'min(100%, 720px)', marginLeft: 'auto', marginRight: 'auto' },
  reading: { maxWidth: 'min(100%, 42rem)', marginLeft: 'auto', marginRight: 'auto' },
};

const DESIGN_BOX = {
  default: {},
  muted: {
    background: 'var(--cream, #F7F5F1)',
    padding: 'clamp(1rem, 3vw, 1.5rem)',
    borderRadius: 'var(--r-md, 18px)',
  },
  accent: {
    background: 'color-mix(in srgb, var(--accent, #F54E25) 10%, transparent)',
    padding: 'clamp(1rem, 3vw, 1.5rem)',
    borderRadius: 'var(--r-md, 18px)',
  },
  bordered: {
    border: '1px solid var(--cream-3, #E0DAD0)',
    borderRadius: 'var(--r-md, 18px)',
    padding: 'clamp(1rem, 3vw, 1.35rem)',
    background: 'var(--surface, #FDFCFA)',
  },
  card: {
    background: 'var(--surface, #FDFCFA)',
    borderRadius: 'var(--r-md, 18px)',
    padding: 'clamp(1.15rem, 3vw, 1.75rem)',
    boxShadow: '0 12px 40px rgba(12, 10, 8, 0.08)',
  },
};

function safeHref(href) {
  const s = String(href ?? '').trim();
  if (!s) return undefined;
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^mailto:/i.test(s) || /^tel:/i.test(s)) return s;
  return undefined;
}

function safeImgSrc(src) {
  const s = String(src ?? '').trim();
  if (!s) return undefined;
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  if (/^https:\/\//i.test(s)) return s;
  return undefined;
}

const ANIMATION_CONFIG = {
  'fade-up': { initial: { opacity: 0, y: 32 }, animate: { opacity: 1, y: 0 } },
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 } },
  'slide-left': { initial: { opacity: 0, x: -28 }, animate: { opacity: 1, x: 0 } },
  'slide-right': { initial: { opacity: 0, x: 28 }, animate: { opacity: 1, x: 0 } },
  zoom: { initial: { opacity: 0, scale: 0.94 }, animate: { opacity: 1, scale: 1 } },
};

function AnimatedWrap({ animation, children }) {
  const key = animation ?? 'none';
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-8% 0px -8% 0px' });
  const cfg =
    key === 'none'
      ? {
          initial: { opacity: 1, y: 0, x: 0, scale: 1 },
          animate: { opacity: 1, y: 0, x: 0, scale: 1 },
        }
      : ANIMATION_CONFIG[key] || ANIMATION_CONFIG['fade-up'];
  const visible = key === 'none' ? true : isInView;

  return (
    <motion.div
      ref={ref}
      initial={cfg.initial}
      animate={visible ? cfg.animate : cfg.initial}
      transition={key === 'none' ? { duration: 0 } : { duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      style={{ width: '100%' }}
    >
      {children}
    </motion.div>
  );
}

export function DynamicLandingSections({ sections }) {
  const list = Array.isArray(sections) ? [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : [];
  if (!list.length) {
    return (
      <section
        id="custom-cms"
        data-cms-custom-root
        className="lp-cms-dynamic full-bleed snap-page"
        aria-label="Additional content"
      >
        <div
          className="container"
          data-cms-custom-empty
          style={{ paddingBlock: 'clamp(2.5rem, 6vw, 4rem)', minHeight: 120 }}
        />
      </section>
    );
  }

  return (
    <section
      id="custom-cms"
      data-cms-custom-root
      className="lp-cms-dynamic full-bleed snap-page"
      aria-label="Additional content"
    >
      <div className="container" style={{ paddingBlock: 'clamp(1rem, 2.5vw, 1.75rem)' }}>
        {list.map((block) => {
          const spacing = block.spacing && SPACING_MARGIN[block.spacing] ? block.spacing : 'normal';
          const width = block.width && WIDTH_STYLE[block.width] ? block.width : 'full';
          const design = block.design && DESIGN_BOX[block.design] ? block.design : 'default';
          const marginBottom = SPACING_MARGIN[spacing];
          const designStyle = {
            ...(DESIGN_BOX[design] || {}),
            ...(block.surfaceColor ? { background: block.surfaceColor } : {}),
          };
          const widthStyle = WIDTH_STYLE[width] || WIDTH_STYLE.full;
          const textColor = block.textColor ? { color: block.textColor } : {};

          return (
            <div key={block.id} data-cms-block-id={block.id} style={{ marginBottom }}>
              <div style={designStyle}>
                <div style={{ ...widthStyle, width: '100%' }}>
                  <AnimatedWrap animation={block.animation}>
                    <BlockRenderer block={block} textColor={textColor} />
                  </AnimatedWrap>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BlockRenderer({ block, textColor = {} }) {
  const align =
    block.align === 'center' ? 'center' : block.align === 'right' ? 'right' : 'left';

  switch (block.type) {
    case 'heading': {
      const Tag = block.level === 3 ? 'h3' : block.level === 4 ? 'h4' : 'h2';
      return (
        <Tag
          className="section-title"
          style={{
            textAlign: align,
            marginBottom: '0.65rem',
            fontSize: block.level >= 3 ? 'clamp(1.35rem, 3vw, 1.75rem)' : undefined,
            ...textColor,
          }}
        >
          {block.text || ''}
        </Tag>
      );
    }
    case 'paragraph':
      return (
        <p className="section-lead" style={{ textAlign: align, whiteSpace: 'pre-wrap', margin: 0, ...textColor }}>
          {block.text || ''}
        </p>
      );
    case 'divider':
      return (
        <hr
          style={{
            border: 'none',
            borderTop: `1px solid ${block.textColor || 'var(--cream-3, #E0DAD0)'}`,
            margin: '1.25rem 0',
          }}
        />
      );
    case 'spacer':
      return <div style={{ height: Math.min(120, Math.max(8, Number(block.height) || 24)) }} aria-hidden />;
    case 'columns':
      return (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 'var(--s-4, 32px)',
            alignItems: 'start',
          }}
        >
          <p className="section-lead" style={{ whiteSpace: 'pre-wrap', margin: 0, ...textColor }}>
            {block.left || ''}
          </p>
          <p className="section-lead" style={{ whiteSpace: 'pre-wrap', margin: 0, ...textColor }}>
            {block.right || ''}
          </p>
        </div>
      );
    case 'button': {
      const label = block.label || 'Button';
      const href = safeHref(block.href);
      return (
        <div style={{ textAlign: align }}>
          {href ? (
            <a
              href={href}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px 22px',
                borderRadius: 'var(--r-md, 18px)',
                background: 'var(--accent, #F54E25)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.95rem',
                textDecoration: 'none',
                border: 'none',
                cursor: 'pointer',
                ...textColor,
              }}
            >
              {label}
            </a>
          ) : (
            <span
              style={{
                display: 'inline-flex',
                padding: '12px 22px',
                borderRadius: 'var(--r-md, 18px)',
                background: 'var(--accent, #F54E25)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.95rem',
                ...textColor,
              }}
            >
              {label}
            </span>
          )}
        </div>
      );
    }
    case 'image': {
      const src = safeImgSrc(block.src);
      const alt = String(block.alt ?? '').trim() || '';
      if (!src) {
        return (
          <div
            style={{
              padding: '2rem',
              textAlign: 'center',
              borderRadius: 'var(--r-md, 18px)',
              border: '1px dashed var(--cream-3, #E0DAD0)',
              color: 'var(--ink-2, #2A2420)',
              fontSize: '0.9rem',
            }}
          >
            Add an image URL in the editor (https or site path).
          </div>
        );
      }
      return (
        <figure style={{ margin: 0, textAlign: align }}>
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            style={{ maxWidth: '100%', height: 'auto', borderRadius: 'var(--r-md, 12px)', display: 'inline-block' }}
          />
        </figure>
      );
    }
    case 'quote': {
      const q = block.text || '';
      const cite = String(block.attribution ?? '').trim();
      return (
        <blockquote
          style={{
            margin: 0,
            paddingLeft: '1.25rem',
            borderLeft: '4px solid var(--accent, #F54E25)',
            fontSize: 'clamp(1.05rem, 2.2vw, 1.2rem)',
            fontStyle: 'italic',
            lineHeight: 1.55,
            textAlign: align,
            ...textColor,
          }}
        >
          <p style={{ margin: '0 0 0.5rem' }}>{q}</p>
          {cite ? (
            <cite style={{ fontStyle: 'normal', fontSize: '0.9rem', opacity: 0.85, display: 'block' }}>— {cite}</cite>
          ) : null}
        </blockquote>
      );
    }
    case 'list': {
      const items = Array.isArray(block.items) ? block.items.map((s) => String(s).trim()).filter(Boolean) : [];
      return (
        <ul
          className="section-lead"
          style={{
            margin: 0,
            paddingLeft: '1.35rem',
            textAlign: align,
            listStylePosition: 'outside',
            ...textColor,
          }}
        >
          {items.map((line, i) => (
            <li key={i} style={{ marginBottom: '0.45rem' }}>
              {line}
            </li>
          ))}
        </ul>
      );
    }
    case 'table': {
      const headers = Array.isArray(block.headers) ? block.headers : [];
      const rows = Array.isArray(block.rows) ? block.rows : [];
      return (
        <div style={{ overflowX: 'auto', borderRadius: 'var(--r-md, 18px)', border: '1px solid var(--cream-3, #E0DAD0)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem', ...textColor }}>
            {headers.length > 0 && (
              <thead>
                <tr style={{ background: 'var(--surface, #FDFCFA)' }}>
                  {headers.map((h, i) => (
                    <th
                      key={i}
                      style={{
                        textAlign: 'left',
                        padding: '12px 14px',
                        fontWeight: 700,
                        borderBottom: '1px solid var(--cream-3, #E0DAD0)',
                        ...(Object.keys(textColor).length ? textColor : { color: 'var(--ink, #0C0A08)' }),
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 ? 'var(--cream, #F7F5F1)' : 'transparent' }}>
                  {(Array.isArray(row) ? row : []).map((cell, ci) => (
                    <td
                      key={ci}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid var(--cream-2, #EEEBE5)',
                        verticalAlign: 'top',
                        ...(Object.keys(textColor).length ? textColor : { color: 'var(--ink-2, #2A2420)' }),
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    default:
      return null;
  }
}

export default DynamicLandingSections;
