import React from 'react';

/**
 * Consistent CLM page chrome: title, optional lede, stacked body (cards / charts).
 * Matches Profile and dashboard visual language (Inter, navy text, soft cards).
 */
export default function ClmPageShell({ title, lede, narrow, children }) {
  return (
    <div className={`cl-page${narrow ? ' cl-page--narrow' : ''}`}>
      <h1 className="cl-page-head">{title}</h1>
      {lede ? <p className="cl-page-lede">{lede}</p> : null}
      <div className="cl-page-body">{children}</div>
    </div>
  );
}
