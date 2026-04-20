import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
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

/**
 * App-style sortable list: pointer + touch + keyboard, smooth transforms,
 * drag handle only (so inputs/selects don’t steal drags).
 */

const POINTER = { activationConstraint: { distance: 6 } };
const TOUCH = { activationConstraint: { delay: 120, tolerance: 6 } };

export function SortableVerticalList({ items, onReorder, children, renderDragOverlay }) {
  const [activeId, setActiveId] = useState(null);
  const sensors = useSensors(
    useSensor(PointerSensor, POINTER),
    useSensor(TouchSensor, TOUCH),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const oldIndex = items.indexOf(active.id);
    const newIndex = items.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(items, oldIndex, newIndex));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
      {typeof renderDragOverlay === 'function' && (
        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' }}>
          {activeId ? renderDragOverlay(activeId) : null}
        </DragOverlay>
      )}
    </DndContext>
  );
}

export function SortableRow({ id, children }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    position: 'relative',
    zIndex: isDragging ? 2 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({
        setHandleRef: setActivatorNodeRef,
        handleListeners: listeners,
        handleAttributes: attributes,
        isDragging,
      })}
    </div>
  );
}
