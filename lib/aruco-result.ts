import { isDiagnosticMarkerId, isPrintedMarkerId, type MarkerObservation } from "./aruco-types";

type DetectedCorner={x:number;y:number};
export type DetectedMarker={id:number;corners:DetectedCorner[]};

function normalizeMarkers(markers:DetectedMarker[],width:number,height:number,accept:(id:unknown)=>boolean):MarkerObservation[]{
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return [];
  return markers.flatMap(marker=>accept(marker.id)&&marker.corners.length===4&&marker.corners.every(corner=>Number.isFinite(corner.x)&&Number.isFinite(corner.y)&&corner.x>=0&&corner.x<=width&&corner.y>=0&&corner.y<=height)
    ?[{id:marker.id,corners:marker.corners.map(corner=>({x:corner.x/width,y:corner.y/height})) as MarkerObservation["corners"]}]
    :[]);
}
/** Converts SDK pixels to camera coordinates and drops markers we never print. */
export function normalizeAllowedMarkers(markers:DetectedMarker[],width:number,height:number):MarkerObservation[]{return normalizeMarkers(markers,width,height,isPrintedMarkerId);}
/** Local diagnostic output for the active dictionary only; never an identity source. */
export function normalizeDebugMarkers(markers:DetectedMarker[],width:number,height:number):MarkerObservation[]{return normalizeMarkers(markers,width,height,isDiagnosticMarkerId);}
