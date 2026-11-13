import { isPrintedMarkerId, type MarkerObservation } from "./aruco-types";

type DetectedCorner={x:number;y:number};
export type DetectedMarker={id:number;corners:DetectedCorner[]};

/** Converts SDK pixels to camera coordinates and drops markers we never print. */
export function normalizeAllowedMarkers(markers:DetectedMarker[],width:number,height:number):MarkerObservation[]{
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return [];
  return markers.flatMap(marker=>isPrintedMarkerId(marker.id)&&marker.corners.length===4&&marker.corners.every(corner=>Number.isFinite(corner.x)&&Number.isFinite(corner.y))
    ?[{id:marker.id,corners:marker.corners.map(corner=>({x:corner.x/width,y:corner.y/height})) as MarkerObservation["corners"]}]
    :[]);
}
