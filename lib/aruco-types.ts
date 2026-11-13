/**
 * Coordinates are normalized against the unmirrored camera frame. The preview
 * layer is responsible for mirroring them together with the camera image.
 */
export type MarkerPoint={x:number;y:number};
export type MarkerObservation={id:number;corners:[MarkerPoint,MarkerPoint,MarkerPoint,MarkerPoint]};
export type MarkerFrame={sequence:number;generation:number;capturedAt:number;markers:MarkerObservation[];processingMs?:number};

/** Matches the printed DICT_4X4_50 cards supplied for the booth. */
export const ARUCO_DICTIONARY="ARUCO_4X4_50" as const;
export const ARUCO_MARKER_IDS=[0,1] as const;
export function isPrintedMarkerId(value:unknown):value is typeof ARUCO_MARKER_IDS[number]{return typeof value==="number"&&ARUCO_MARKER_IDS.includes(value as typeof ARUCO_MARKER_IDS[number]);}
/** OpenCV DICT_4X4_50 corrects one bit; js-aruco2 uses a strict `<` comparison. */
export const ARUCO_MAX_HAMMING_DISTANCE=2;
