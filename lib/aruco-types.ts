/**
 * Coordinates are normalized against the unmirrored camera frame. The preview
 * layer is responsible for mirroring them together with the camera image.
 */
export type MarkerPoint={x:number;y:number};
export type MarkerObservation={id:number;corners:[MarkerPoint,MarkerPoint,MarkerPoint,MarkerPoint]};
/** `debugMarkers` is local diagnostic output only; it is never identity input. */
export type MarkerFrame={sequence:number;generation:number;capturedAt:number;markers:MarkerObservation[];processingMs?:number;debugMarkers?:MarkerObservation[];analysisWidth?:number;analysisHeight?:number};

/** Matches the printed DICT_4X4_50 cards supplied for the booth. */
export const ARUCO_DICTIONARY="ARUCO_4X4_50" as const;
export const ARUCO_DICTIONARY_MARKER_COUNT=50;
export const ARUCO_MARKER_IDS=[0,1] as const;
export function isPrintedMarkerId(value:unknown):value is typeof ARUCO_MARKER_IDS[number]{return typeof value==="number"&&ARUCO_MARKER_IDS.includes(value as typeof ARUCO_MARKER_IDS[number]);}
export function isDiagnosticMarkerId(value:unknown):value is number{return typeof value==="number"&&Number.isInteger(value)&&value>=0&&value<ARUCO_DICTIONARY_MARKER_COUNT;}
/** OpenCV DICT_4X4_50 corrects one bit; js-aruco2 uses a strict `<` comparison. */
export const ARUCO_MAX_HAMMING_DISTANCE=2;
