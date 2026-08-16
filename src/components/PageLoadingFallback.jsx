// Suspense fallback for lazy-loaded pages (see the lazy() imports at
// the top of App.jsx). Only shows briefly on someone's FIRST visit to
// a given secondary page in a session — after that, the browser has
// already cached the chunk and this won't reappear. Kept as a simple
// branded spinner rather than a full skeleton layout per page: with
// dozens of pages and code-splitting being brand new, building a
// bespoke skeleton for every single one isn't worth it for something
// that shows for a fraction of a second on a cache miss.

export default function PageLoadingFallback() {
  return (
    <div className="page-loading-fallback">
      <div className="page-loading-fallback__spinner" />
    </div>
  );
}
