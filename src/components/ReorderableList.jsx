// Generic drag-to-reorder vertical list — native HTML5 drag-and-drop,
// no extra library needed for a simple linear ranking list like this
// (unlike the Quickdash grid, which genuinely needed react-grid-layout
// for 2D drag+resize+collision).

import { useState } from "react";

export default function ReorderableList({ items, onReorder, renderItem }) {
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);

  function handleDrop(dropIndex) {
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    const next = [...items];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, moved);
    onReorder(next);
    setDragIndex(null);
    setOverIndex(null);
  }

  return (
    <ol className="reorder-list">
      {items.map((item, i) => (
        <li
          key={item}
          className={`reorder-list__item ${dragIndex === i ? "reorder-list__item--dragging" : ""} ${overIndex === i && dragIndex !== i ? "reorder-list__item--over" : ""}`}
          draggable
          onDragStart={() => setDragIndex(i)}
          onDragOver={(e) => {
            e.preventDefault();
            setOverIndex(i);
          }}
          onDrop={() => handleDrop(i)}
          onDragEnd={() => {
            setDragIndex(null);
            setOverIndex(null);
          }}
        >
          <span className="reorder-list__rank">{i + 1}</span>
          <span className="reorder-list__handle" title="Drag to reorder">⠿</span>
          <span className="reorder-list__label">{renderItem ? renderItem(item) : item}</span>
        </li>
      ))}
    </ol>
  );
}
