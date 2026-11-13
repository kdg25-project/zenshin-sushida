import arucoModule from "js-aruco2";
import "js-aruco2/src/dictionaries/aruco_4x4_1000";
import { ARUCO_DICTIONARY } from "./aruco-types";

const source=arucoModule.AR.DICTIONARIES.ARUCO_4X4_1000;
if(!source)throw new Error("ARUCO_4X4_1000 dictionary unavailable");

/**
 * OpenCV's DICT_4X4_50 is the first 50 codes of its 4x4 predefined family.
 * Restricting the detector to that subset keeps the runtime dictionary aligned
 * with the two IDs printed for this booth.
 */
if(!arucoModule.AR.DICTIONARIES[ARUCO_DICTIONARY])arucoModule.AR.DICTIONARIES[ARUCO_DICTIONARY]={nBits:16,tau:1,codeList:source.codeList.slice(0,50) as number[][]};

export { arucoModule };
