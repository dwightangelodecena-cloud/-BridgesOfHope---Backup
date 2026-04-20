import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import CmsImageField from '@/components/admin/CmsImageField';

/** Short distance so drags start easily inside scrollable CMS panels (see dnd-kit + overflow). */
const POINTER = { activationConstraint: { distance: 3 } };
const TOUCH = { activationConstraint: { delay: 80, tolerance: 8 } };

const MATERIALS = [
  { type: 'heading', label: 'Heading' },
  { type: 'paragraph', label: 'Text' },
  { type: 'button', label: 'Button' },
  { type: 'image', label: 'Image' },
  { type: 'quote', label: 'Quote' },
  { type: 'list', label: 'List' },
  { type: 'table', label: 'Table' },
  { type: 'columns', label: 'Columns' },
  { type: 'divider', label: 'Divider' },
  { type: 'spacer', label: 'Spacer' },
];

const CUSTOM_DESIGN_OPTS = [
  { id: 'default', label: 'Plain' },
  { id: 'muted', label: 'Soft background' },
  { id: 'accent', label: 'Accent tint' },
  { id: 'bordered', label: 'Bordered' },
  { id: 'card', label: 'Card + shadow' },
];
const CUSTOM_SPACING_OPTS = [
  { id: 'tight', label: 'Tight' },
  { id: 'normal', label: 'Normal' },
  { id: 'loose', label: 'Loose' },
];
const CUSTOM_WIDTH_OPTS = [
  { id: 'full', label: 'Full width' },
  { id: 'narrow', label: 'Narrow' },
  { id: 'reading', label: 'Reading' },
];
const CUSTOM_ANIM_OPTS = [
  { id: 'none', label: 'None' },
  { id: 'fade-up', label: 'Fade up' },
  { id: 'fade', label: 'Fade' },
  { id: 'slide-left', label: 'Slide left' },
  { id: 'slide-right', label: 'Slide right' },
  { id: 'zoom', label: 'Zoom in' },
];

const FIELD = { marginBottom: 12 };
const LABEL = { fontSize: 12, fontWeight: 700, color: '#707EAE', display: 'block', marginBottom: 6 };
const INPUT = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #E9EDF7',
  borderRadius: 10,
  fontSize: 13,
  fontFamily: 'Inter, sans-serif',
};

const PALETTE_PREFIX = 'palette-';
const EMPTY_ID = 'canvas-empty-zone';
const DROP_END_ID = 'canvas-drop-end';
/** Full-size drop target over the live iframe preview (parent DOM). */
const LIVE_PREVIEW_DROP_ID = 'cb-live-preview-drop';

/** Wix-style: insertion index from pointer Y against real blocks in the iframe (viewport coords). */
function computeInsertIndexFromPointer(clientY, sectionEl) {
  if (!sectionEl) return 0;
  const blocks = [...sectionEl.querySelectorAll('[data-cms-block-id]')];
  if (blocks.length === 0) return 0;
  for (let i = 0; i < blocks.length; i++) {
    const r = blocks[i].getBoundingClientRect();
    const mid = r.top + r.height / 2;
    if (clientY < mid) return i;
  }
  return blocks.length;
}

/** Pixel offset from top of `splitRightEl` for the horizontal insertion marker. */
function computeInsertLineTopPx(sectionEl, splitRightEl, insertIndex) {
  if (!sectionEl || !splitRightEl) return null;
  const sr = splitRightEl.getBoundingClientRect();
  const blocks = [...sectionEl.querySelectorAll('[data-cms-block-id]')];
  let lineYViewport;
  if (blocks.length === 0) {
    const r = sectionEl.getBoundingClientRect();
    lineYViewport = r.top + Math.min(56, r.height / 2);
  } else if (insertIndex <= 0) {
    lineYViewport = blocks[0].getBoundingClientRect().top - 2;
  } else if (insertIndex >= blocks.length) {
    lineYViewport = blocks[blocks.length - 1].getBoundingClientRect().bottom + 2;
  } else {
    const prev = blocks[insertIndex - 1].getBoundingClientRect();
    const next = blocks[insertIndex].getBoundingClientRect();
    lineYViewport = (prev.bottom + next.top) / 2;
  }
  const top = lineYViewport - sr.top;
  if (top < 0 || top > sr.height) return null;
  return top;
}

function paletteId(type) {
  return `${PALETTE_PREFIX}${type}`;
}

function isPaletteId(id) {
  return typeof id === 'string' && id.startsWith(PALETTE_PREFIX);
}

function blockPreviewLine(block) {
  switch (block.type) {
    case 'heading':
      return block.text?.slice(0, 72) || 'Heading';
    case 'paragraph':
      return block.text?.slice(0, 96) || 'Text';
    case 'button':
      return block.label || 'Button';
    case 'image':
      return block.src ? block.src.slice(0, 48) : 'Image';
    case 'quote':
      return block.text?.slice(0, 80) || 'Quote';
    case 'list':
      return `${(block.items || []).length || 0} items`;
    case 'table':
      return `Table (${(block.headers || []).length} cols)`;
    case 'columns':
      return 'Two columns';
    case 'spacer':
      return `Spacer ${block.height || 24}px`;
    case 'divider':
      return 'Divider';
    default:
      return block.type;
  }
}

function PaletteTile({ type, label }) {
  const id = paletteId(type);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { source: 'palette', blockType: type },
  });
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="cb-palette-tile"
      title={`Drag “${label}” into the canvas`}
    >
      <span style={{ fontWeight: 700, fontSize: 13, color: '#1B2559' }}>{label}</span>
      <span style={{ fontSize: 11, color: '#94a3b8' }}>drag</span>
    </div>
  );
}

function CanvasEmptyDrop({ minHeight = 260 }) {
  const { setNodeRef, isOver } = useDroppable({ id: EMPTY_ID });
  return (
    <div
      ref={setNodeRef}
      style={{
        minHeight,
        borderRadius: 16,
        border: `2px dashed ${isOver ? '#7c3aed' : '#cbd5e1'}`,
        background: isOver ? 'rgba(124, 58, 237, 0.08)' : 'rgba(248, 250, 252, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#64748b',
        fontSize: 14,
        fontWeight: 600,
        padding: 24,
        textAlign: 'center',
      }}
    >
      Drop a library tile here to start
    </div>
  );
}

function LivePreviewDropOverlay({ activeId }) {
  const draggingPalette = activeId != null && isPaletteId(activeId);
  const { setNodeRef, isOver } = useDroppable({ id: LIVE_PREVIEW_DROP_ID });
  return (
    <div
      ref={setNodeRef}
      className="cb-live-drop-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 6,
        pointerEvents: draggingPalette ? 'auto' : 'none',
        border: isOver ? '3px dashed #7c3aed' : '2px dashed transparent',
        background: isOver ? 'rgba(124, 58, 237, 0.09)' : 'transparent',
        borderRadius: 6,
        transition: 'border 0.12s ease, background 0.12s ease',
      }}
      aria-hidden
    />
  );
}

function CanvasEndDrop() {
  const { setNodeRef, isOver } = useDroppable({ id: DROP_END_ID });
  return (
    <div
      ref={setNodeRef}
      style={{
        marginTop: 8,
        minHeight: 44,
        borderRadius: 12,
        border: `2px dashed ${isOver ? '#7c3aed' : 'rgba(148, 163, 184, 0.35)'}`,
        background: isOver ? 'rgba(124, 58, 237, 0.07)' : 'rgba(248, 250, 252, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        color: '#94a3b8',
      }}
    >
      Drop here to append at the end
    </div>
  );
}

function SortableCanvasRow({ id, children }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: 'relative',
    zIndex: isDragging ? 2 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ setHandleRef: setActivatorNodeRef, handleListeners: listeners, handleAttributes: attributes })}
    </div>
  );
}

function BlockInspector({ block, patchCustomBlock, INPUT: inputStyle, LABEL: labelStyle, FIELD: fieldStyle }) {
  if (!block) {
    return (
      <div
        style={{
          border: '1px solid #E9EDF7',
          borderRadius: 16,
          padding: 14,
          background: '#fafbff',
          color: '#64748b',
          fontSize: 12,
          lineHeight: 1.45,
        }}
      >
        Select a block in the list, or drag a tile from the library.
      </div>
    );
  }

  const clearTextColor = () => patchCustomBlock(block.id, { textColor: undefined });
  const clearSurface = () => patchCustomBlock(block.id, { surfaceColor: undefined });

  return (
    <div
      style={{
        border: '1px solid #E9EDF7',
        borderRadius: 16,
        padding: 16,
        background: 'white',
        maxHeight: 'min(70vh, 560px)',
        overflow: 'auto',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.06em', marginBottom: 12 }}>EDIT BLOCK</div>
      <div style={{ fontWeight: 800, fontSize: 15, color: '#1B2559', marginBottom: 14, textTransform: 'capitalize' }}>{block.type}</div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Text color</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <input
            type="color"
            style={{ width: 44, height: 36, padding: 0, border: '1px solid #E9EDF7', borderRadius: 8, cursor: 'pointer' }}
            value={block.textColor || '#0c0a08'}
            onChange={(e) => patchCustomBlock(block.id, { textColor: e.target.value })}
          />
          <button type="button" className="cm-btn cm-btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={clearTextColor}>
            Use theme default
          </button>
        </div>
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>Block background</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <input
            type="color"
            style={{ width: 44, height: 36, padding: 0, border: '1px solid #E9EDF7', borderRadius: 8, cursor: 'pointer' }}
            value={block.surfaceColor || '#f7f5f1'}
            onChange={(e) => patchCustomBlock(block.id, { surfaceColor: e.target.value })}
          />
          <button type="button" className="cm-btn cm-btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={clearSurface}>
            Use design preset only
          </button>
        </div>
        <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, marginBottom: 0 }}>Overrides the “Design” surface color when set.</p>
      </div>

      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: '#94a3b8',
          letterSpacing: '0.06em',
          marginBottom: 8,
          marginTop: 4,
        }}
      >
        Layout & motion
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <label style={{ ...labelStyle, marginBottom: 4 }}>Design</label>
          <select
            style={inputStyle}
            value={block.design || 'default'}
            onChange={(e) => patchCustomBlock(block.id, { design: e.target.value })}
          >
            {CUSTOM_DESIGN_OPTS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ ...labelStyle, marginBottom: 4 }}>Animation</label>
          <select
            style={inputStyle}
            value={block.animation ?? 'none'}
            onChange={(e) => patchCustomBlock(block.id, { animation: e.target.value })}
          >
            {CUSTOM_ANIM_OPTS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ ...labelStyle, marginBottom: 4 }}>Spacing</label>
          <select
            style={inputStyle}
            value={block.spacing || 'normal'}
            onChange={(e) => patchCustomBlock(block.id, { spacing: e.target.value })}
          >
            {CUSTOM_SPACING_OPTS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ ...labelStyle, marginBottom: 4 }}>Width</label>
          <select
            style={inputStyle}
            value={block.width || 'full'}
            onChange={(e) => patchCustomBlock(block.id, { width: e.target.value })}
          >
            {CUSTOM_WIDTH_OPTS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {(block.type === 'heading' || block.type === 'paragraph' || block.type === 'button') && (
        <div style={fieldStyle}>
          <label style={labelStyle}>Text align</label>
          <select
            style={inputStyle}
            value={block.align || 'left'}
            onChange={(e) => patchCustomBlock(block.id, { align: e.target.value })}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      )}

      {block.type === 'heading' && (
        <>
          <div style={fieldStyle}>
            <label style={labelStyle}>Text</label>
            <input style={inputStyle} value={block.text || ''} onChange={(e) => patchCustomBlock(block.id, { text: e.target.value })} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Level</label>
            <select style={inputStyle} value={block.level || 2} onChange={(e) => patchCustomBlock(block.id, { level: Number(e.target.value) })}>
              <option value={2}>H2</option>
              <option value={3}>H3</option>
              <option value={4}>H4</option>
            </select>
          </div>
        </>
      )}

      {block.type === 'paragraph' && (
        <div style={fieldStyle}>
          <label style={labelStyle}>Text</label>
          <textarea style={{ ...inputStyle, minHeight: 120 }} value={block.text || ''} onChange={(e) => patchCustomBlock(block.id, { text: e.target.value })} />
        </div>
      )}

      {block.type === 'columns' && (
        <>
          <div style={fieldStyle}>
            <label style={labelStyle}>Left column</label>
            <textarea style={{ ...inputStyle, minHeight: 80 }} value={block.left || ''} onChange={(e) => patchCustomBlock(block.id, { left: e.target.value })} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Right column</label>
            <textarea style={{ ...inputStyle, minHeight: 80 }} value={block.right || ''} onChange={(e) => patchCustomBlock(block.id, { right: e.target.value })} />
          </div>
        </>
      )}

      {block.type === 'table' && (
        <>
          <div style={fieldStyle}>
            <label style={labelStyle}>Headers (comma-separated)</label>
            <input
              style={inputStyle}
              value={(block.headers || []).join(', ')}
              onChange={(e) => {
                const headers = e.target.value.split(',').map((s) => s.trim());
                patchCustomBlock(block.id, { headers });
              }}
            />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Rows (one per line, comma cells)</label>
            <textarea
              style={{ ...inputStyle, minHeight: 100 }}
              value={(block.rows || []).map((row) => row.join(', ')).join('\n')}
              onChange={(e) => {
                const rows = e.target.value.split('\n').map((line) => line.split(',').map((s) => s.trim()));
                patchCustomBlock(block.id, { rows });
              }}
            />
          </div>
        </>
      )}

      {block.type === 'spacer' && (
        <div style={fieldStyle}>
          <label style={labelStyle}>Height (px)</label>
          <input
            type="number"
            style={{ ...inputStyle, maxWidth: 140 }}
            value={block.height}
            onChange={(e) => patchCustomBlock(block.id, { height: Number(e.target.value) })}
          />
        </div>
      )}

      {block.type === 'divider' && <p style={{ fontSize: 12, color: '#94a3b8' }}>Line color follows text color when set.</p>}

      {block.type === 'button' && (
        <>
          <div style={fieldStyle}>
            <label style={labelStyle}>Label</label>
            <input style={inputStyle} value={block.label || ''} onChange={(e) => patchCustomBlock(block.id, { label: e.target.value })} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Link URL</label>
            <input
              style={inputStyle}
              placeholder="https://… or /path"
              value={block.href || ''}
              onChange={(e) => patchCustomBlock(block.id, { href: e.target.value })}
            />
          </div>
        </>
      )}

      {block.type === 'image' && (
        <>
          <CmsImageField
            label="Image"
            value={block.src || ''}
            onChange={(url) => patchCustomBlock(block.id, { src: url })}
            hint="Replace, upload to Supabase, or clear. Animation and spacing use the controls above."
          />
          <div style={fieldStyle}>
            <label style={labelStyle}>Alt text</label>
            <input style={inputStyle} value={block.alt || ''} onChange={(e) => patchCustomBlock(block.id, { alt: e.target.value })} />
          </div>
        </>
      )}

      {block.type === 'quote' && (
        <>
          <div style={fieldStyle}>
            <label style={labelStyle}>Quote</label>
            <textarea style={{ ...inputStyle, minHeight: 100 }} value={block.text || ''} onChange={(e) => patchCustomBlock(block.id, { text: e.target.value })} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Attribution (optional)</label>
            <input style={inputStyle} value={block.attribution || ''} onChange={(e) => patchCustomBlock(block.id, { attribution: e.target.value })} />
          </div>
        </>
      )}

      {(block.type === 'list' || block.type === 'quote' || block.type === 'image') && (
        <div style={fieldStyle}>
          <label style={labelStyle}>Align</label>
          <select
            style={inputStyle}
            value={block.align || 'left'}
            onChange={(e) => patchCustomBlock(block.id, { align: e.target.value })}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      )}

      {block.type === 'list' && (
        <div style={fieldStyle}>
          <label style={labelStyle}>Items (one per line)</label>
          <textarea
            style={{ ...inputStyle, minHeight: 120 }}
            value={(block.items || []).join('\n')}
            onChange={(e) => {
              const items = e.target.value
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean);
              patchCustomBlock(block.id, { items });
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function CustomBlocksVisualEditor({
  customSections,
  patchCustomBlock,
  insertCustomBlockAt,
  reorderCustomBlocks,
  removeCustomBlock,
  /** Wide layout: tools on the left, live preview on the right with real drop target */
  splitLayout = false,
  livePreviewSlot = null,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [activeId, setActiveId] = useState(null);

  const sortedBlocks = useMemo(
    () => [...customSections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [customSections],
  );

  const sortedBlockIds = useMemo(() => sortedBlocks.map((b) => b.id), [sortedBlocks]);

  const selectedBlock = useMemo(() => sortedBlocks.find((b) => b.id === selectedId) || null, [sortedBlocks, selectedId]);

  useEffect(() => {
    if (selectedId && !sortedBlocks.some((b) => b.id === selectedId)) setSelectedId(null);
  }, [sortedBlocks, selectedId]);

  const sensors = useSensors(
    useSensor(PointerSensor, POINTER),
    useSensor(TouchSensor, TOUCH),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const liveInsertIndexRef = useRef(0);
  const iframeMountRef = useRef(null);
  const splitRightRef = useRef(null);
  const [liveInsertLineTop, setLiveInsertLineTop] = useState(null);

  const updateLiveInsertFromPointer = useCallback((clientX, clientY) => {
    const iframe = iframeMountRef.current;
    const splitEl = splitRightRef.current;
    if (!iframe || !splitEl) return;
    try {
      const doc = iframe.contentDocument;
      if (!doc) return;
      const section = doc.getElementById('custom-cms');
      if (!section) {
        liveInsertIndexRef.current = 0;
        setLiveInsertLineTop(null);
        return;
      }
      const idx = computeInsertIndexFromPointer(clientY, section);
      liveInsertIndexRef.current = idx;
      const topPx = computeInsertLineTopPx(section, splitEl, idx);
      setLiveInsertLineTop(topPx);
    } catch {
      liveInsertIndexRef.current = sortedBlocks.length;
      setLiveInsertLineTop(null);
    }
  }, [sortedBlocks.length]);

  useEffect(() => {
    if (!splitLayout || !livePreviewSlot || !activeId || !isPaletteId(activeId)) {
      setLiveInsertLineTop(null);
      return undefined;
    }
    const onMove = (e) => updateLiveInsertFromPointer(e.clientX, e.clientY);
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [splitLayout, livePreviewSlot, activeId, updateLiveInsertFromPointer]);

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event;
      setActiveId(null);
      setLiveInsertLineTop(null);
      if (!over) return;

      const activeData = active.data?.current;
      if (activeData?.source === 'palette') {
        const type = activeData.blockType;
        let insertAt = sortedBlocks.length;
        if (over.id === LIVE_PREVIEW_DROP_ID) {
          insertAt = Math.min(Math.max(0, liveInsertIndexRef.current), sortedBlocks.length);
        } else if (over.id === EMPTY_ID) insertAt = 0;
        else if (over.id === DROP_END_ID) insertAt = sortedBlocks.length;
        else {
          const idx = sortedBlocks.findIndex((b) => b.id === over.id);
          if (idx >= 0) insertAt = idx;
        }
        liveInsertIndexRef.current = 0;
        insertCustomBlockAt(type, insertAt);
        return;
      }

      if (active.id === over.id) return;
      const oldIndex = sortedBlockIds.indexOf(active.id);
      const newIndex = sortedBlockIds.indexOf(over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      reorderCustomBlocks(arrayMove(sortedBlockIds, oldIndex, newIndex));
    },
    [insertCustomBlockAt, reorderCustomBlocks, sortedBlockIds, sortedBlocks],
  );

  const overlayPaletteType = activeId && isPaletteId(activeId) ? activeId.slice(PALETTE_PREFIX.length) : null;
  const overlayBlock = activeId && !isPaletteId(activeId) ? sortedBlocks.find((b) => b.id === activeId) : null;

  const useSplit = Boolean(splitLayout && livePreviewSlot);
  const emptyDropMin = useSplit ? 140 : 260;

  const previewWithIframeRef =
    useSplit && React.isValidElement(livePreviewSlot)
      ? React.cloneElement(livePreviewSlot, {
          onIframeRef: (node) => {
            iframeMountRef.current = node;
            const orig = livePreviewSlot.props.onIframeRef;
            if (typeof orig === 'function') orig(node);
          },
        })
      : livePreviewSlot;

  const renderPaletteCanvas = () => (
    <>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em', marginBottom: 8 }}>LIBRARY</div>
      <div className="cb-palette-grid">
        {MATERIALS.map(({ type, label }) => (
          <PaletteTile key={type} type={type} label={label} />
        ))}
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8', margin: '10px 0 12px', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <span style={{ fontWeight: 700, color: '#64748b' }}>Add to end</span>
        {MATERIALS.map(({ type, label }) => (
          <button
            key={`add-${type}`}
            type="button"
            className="cm-btn cm-btn-ghost"
            style={{ padding: '4px 8px', fontSize: 11 }}
            onClick={() => insertCustomBlockAt(type, sortedBlocks.length)}
          >
            <Plus size={11} /> {label}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em', marginBottom: 8 }}>
        {useSplit ? 'ON PAGE' : 'STACK'}
      </div>

      <div className="cb-wix-canvas">
        {sortedBlocks.length === 0 ? (
          <CanvasEmptyDrop minHeight={emptyDropMin} />
        ) : (
          <>
            <SortableContext items={sortedBlockIds} strategy={verticalListSortingStrategy}>
              {sortedBlocks.map((block) => (
                <SortableCanvasRow key={block.id} id={block.id}>
                  {({ setHandleRef, handleListeners, handleAttributes }) => (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedId(block.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedId(block.id);
                        }
                      }}
                      style={{
                        marginBottom: 10,
                        borderRadius: 14,
                        border: selectedId === block.id ? '2px solid #F54E25' : '1px solid #E9EDF7',
                        background: selectedId === block.id ? 'rgba(245, 78, 37, 0.04)' : '#fafbff',
                        padding: '10px 12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                      }}
                    >
                      <button
                        type="button"
                        className="cm-dnd-handle"
                        ref={setHandleRef}
                        {...handleListeners}
                        {...handleAttributes}
                        aria-label="Drag to reorder"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          border: 'none',
                          background: '#E9EDF7',
                          padding: '8px 6px',
                          borderRadius: 8,
                          cursor: 'grab',
                          touchAction: 'none',
                          color: '#64748b',
                          flexShrink: 0,
                        }}
                      >
                        <GripVertical size={18} aria-hidden />
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{block.type}</div>
                        <div style={{ fontSize: 13, color: '#334155', marginTop: 4, wordBreak: 'break-word' }}>{blockPreviewLine(block)}</div>
                      </div>
                      <button
                        type="button"
                        className="cm-btn cm-btn-ghost"
                        style={{ padding: '6px 8px', color: '#b91c1c', flexShrink: 0 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeCustomBlock(block.id);
                        }}
                        aria-label="Delete block"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </SortableCanvasRow>
              ))}
            </SortableContext>
            <CanvasEndDrop />
          </>
        )}
      </div>
    </>
  );

  return (
    <div className={`cb-visual-editor${useSplit ? ' cb-visual-editor--split' : ''}`}>
      <style>{`
        .cb-palette-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 8px;
          margin-bottom: 4px;
        }
        .cb-palette-tile {
          display: inline-flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          padding: 10px 10px;
          border-radius: 12px;
          border: 2px dashed #cbd5e1;
          background: white;
          cursor: grab;
          touch-action: none;
          user-select: none;
          min-width: 0;
          width: 100%;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .cb-palette-tile:active { cursor: grabbing; }
        .cb-visual-editor__stack {
          display: flex;
          flex-direction: column;
          gap: 18px;
          align-items: stretch;
          min-width: 0;
        }
        .cb-dnd-surface {
          min-width: 0;
        }
        .cb-wix-canvas {
          border-radius: 14px;
          padding: 10px;
          min-height: 100px;
          background-color: #f8fafc;
          background-image:
            linear-gradient(90deg, rgba(148, 163, 184, 0.22) 1px, transparent 1px),
            linear-gradient(rgba(148, 163, 184, 0.14) 1px, transparent 1px);
          background-size: calc(100% / 12) 28px;
          border: 1px solid #e2e8f0;
        }
        .cb-visual-editor--split { flex: 1; min-height: 0; display: flex; flex-direction: column; }
        .cb-split-root { display: flex; flex: 1; min-height: 0; width: 100%; align-items: stretch; gap: 0; }
        .cb-split-left {
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow-y: auto;
          overscroll-behavior: contain;
          overscroll-behavior-y: contain;
        }
        .cb-split-right { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; position: relative; }
        .cb-split-right .cm-preview-wrap { flex: 1; min-height: 0; display: flex; flex-direction: column; }
      `}</style>

      {!useSplit && (
        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 8px', lineHeight: 1.45 }}>
          Drag tiles into the stack, or use <strong>Add to end</strong>. Order follows the <strong>Page elements</strong> strip in <strong>Page structure</strong>.
        </p>
      )}
      {useSplit && (
        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 12px', lineHeight: 1.45 }}>
          Drag from the library onto the preview — the <strong style={{ color: '#7c3aed' }}>purple line</strong> is the drop position. Click a row to edit styling.
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={({ active }) => setActiveId(active.id)}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setLiveInsertLineTop(null);
        }}
      >
        {useSplit ? (
          <div className="cb-split-root">
            <div
              className="cb-split-left"
              style={{
                width: 'min(340px, 34vw)',
                flexShrink: 0,
                paddingRight: 14,
                borderRight: '1px solid #e2e8f0',
              }}
            >
              {renderPaletteCanvas()}
              <BlockInspector block={selectedBlock} patchCustomBlock={patchCustomBlock} INPUT={INPUT} LABEL={LABEL} FIELD={FIELD} />
            </div>
            <div className="cb-split-right" ref={splitRightRef}>
              {previewWithIframeRef}
              <LivePreviewDropOverlay activeId={activeId} />
              {activeId && isPaletteId(activeId) && liveInsertLineTop != null && (
                <div
                  style={{
                    position: 'absolute',
                    left: 8,
                    right: 8,
                    top: liveInsertLineTop,
                    height: 3,
                    background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
                    borderRadius: 2,
                    pointerEvents: 'none',
                    zIndex: 8,
                    boxShadow: '0 0 14px rgba(124, 58, 237, 0.5)',
                  }}
                  aria-hidden
                />
              )}
            </div>
          </div>
        ) : (
          <div className="cb-visual-editor__stack" style={{ marginBottom: 12 }}>
            <div className="cb-dnd-surface">{renderPaletteCanvas()}</div>
            <div style={{ minWidth: 0 }}>
              <BlockInspector block={selectedBlock} patchCustomBlock={patchCustomBlock} INPUT={INPUT} LABEL={LABEL} FIELD={FIELD} />
            </div>
          </div>
        )}

            <DragOverlay
              zIndex={10050}
              dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' }}
            >
              {overlayPaletteType ? (
                <div
                  style={{
                    padding: '12px 18px',
                    borderRadius: 12,
                    background: 'white',
                    border: '2px solid #F54E25',
                    boxShadow: '0 20px 50px rgba(27, 37, 89, 0.2)',
                    fontWeight: 700,
                    color: '#1B2559',
                  }}
                >
                  Add {MATERIALS.find((m) => m.type === overlayPaletteType)?.label || overlayPaletteType}
                </div>
              ) : overlayBlock ? (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: 'white',
                    border: '2px solid #1B2559',
                    boxShadow: '0 20px 50px rgba(27, 37, 89, 0.18)',
                    fontSize: 13,
                    color: '#1B2559',
                    maxWidth: 320,
                  }}
                >
                  {blockPreviewLine(overlayBlock)}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
    </div>
  );
}
