import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { markerSvg, rasterizeMarkerSvg, rasterizeSvg } from "./aruco-marker-art";
import { arucoModule } from "./aruco-dictionary";
import { normalizeAllowedMarkers } from "./aruco-result";
import { ARUCO_DICTIONARY, ARUCO_MAX_HAMMING_DISTANCE } from "./aruco-types";

describe("printed ArUco artwork",()=>{
  it("round-trips the exact printed SVG through the matching detector",()=>{
    const detector=new arucoModule.AR.Detector({dictionaryName:ARUCO_DICTIONARY,maxHammingDistance:ARUCO_MAX_HAMMING_DISTANCE});
    for(const id of [0,1]){
      const image=rasterizeMarkerSvg(id,24),found=detector.detect(image as unknown as ImageData);
      expect(markerSvg(id)).toContain("<svg");
      expect(found.map(marker=>marker.id)).toContain(id);
    }
  });

  it("keeps the BoothSetup static cards byte-for-byte aligned with the shared SVG generator",()=>{
    for(const id of [0,1])expect(readFileSync(resolve(process.cwd(),`public/markers/marker-id${id}.svg`),"utf8").trim()).toBe(markerSvg(id));
  });

  it("drops an SDK-detected marker outside the printed ID set",()=>{
    const external=new arucoModule.AR.Dictionary("ARUCO_4X4_1000").generateSVG(2),image=rasterizeSvg(external,24);
    const fullDetector=new arucoModule.AR.Detector({dictionaryName:"ARUCO_4X4_1000",maxHammingDistance:ARUCO_MAX_HAMMING_DISTANCE}),detected=fullDetector.detect(image as unknown as ImageData);
    expect(detected.map(marker=>marker.id)).toContain(2);
    const printedDetector=new arucoModule.AR.Detector({dictionaryName:ARUCO_DICTIONARY,maxHammingDistance:ARUCO_MAX_HAMMING_DISTANCE});
    const workerInput=printedDetector.detect(image as unknown as ImageData);
    expect(workerInput.map(marker=>marker.id)).toContain(2);
    expect(normalizeAllowedMarkers(workerInput,image.width,image.height)).toEqual([]);
  });
});
