import type { PreviewCandidate } from "./booth-preview";
export type PreviewLine={candidateId:string;x1:number;y1:number;x2:number;y2:number};
/** Preview JPEG is mirrored for staff, so map camera X exactly once here. */
export function projectPreviewBones(candidates:PreviewCandidate[],width:number,height:number):PreviewLine[]{return candidates.flatMap(candidate=>candidate.bones.map(([x1,y1,x2,y2])=>({candidateId:candidate.id,x1:(1-x1)*width,y1:y1*height,x2:(1-x2)*width,y2:y2*height})));}
