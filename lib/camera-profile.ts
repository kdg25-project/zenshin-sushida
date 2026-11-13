const LIMIT = 120;

/** Opt-in only: ?cameraProfile=1 keeps a bounded browser Performance timeline. */
export function cameraProfileEnabled(search = typeof location === "undefined" ? "" : location.search) {
  return new URLSearchParams(search).get("cameraProfile") === "1";
}

export function measureCameraWork(name:string,startedAt:number,enabled=cameraProfileEnabled()) {
  if(!enabled||typeof performance === "undefined"||!Number.isFinite(startedAt))return;
  if(performance.getEntriesByName(name,"measure").length>=LIMIT)performance.clearMeasures(name);
  performance.measure(name,{start:startedAt,end:performance.now()});
}

/** QA-only bounded marker for requested/successful setup branches, not backend proof. */
export function markCameraDiagnostic(name:string,enabled=cameraProfileEnabled()) {
  if(!enabled||typeof performance === "undefined")return;
  if(performance.getEntriesByName(name,"mark").length>=LIMIT)performance.clearMarks(name);
  performance.mark(name);
}
