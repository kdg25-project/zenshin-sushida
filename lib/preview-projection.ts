import type { PreviewCandidate, PreviewMarker } from "./booth-preview";
export type PreviewLine={candidateId:string;x1:number;y1:number;x2:number;y2:number};
export type PreviewMarkerPolygon={id:number;association:PreviewMarker["association"];candidateId?:string;points:Array<{x:number;y:number}>};
/** Preview JPEG is mirrored for staff, so map camera X exactly once here. */
export function projectPreviewBones(candidates:PreviewCandidate[],width:number,height:number):PreviewLine[]{return candidates.flatMap(candidate=>candidate.bones.map(([x1,y1,x2,y2])=>({candidateId:candidate.id,x1:(1-x1)*width,y1:y1*height,x2:(1-x2)*width,y2:y2*height})));}
/** Preview JPEG is mirrored for staff, so marker corners use the same X mapping as bones. */
export function projectPreviewMarkers(markers:PreviewMarker[],width:number,height:number):PreviewMarkerPolygon[]{return markers.map(marker=>({id:marker.id,association:marker.association,candidateId:marker.candidateId,points:marker.corners.map(([x,y])=>({x:(1-x)*width,y:y*height}))}));}
