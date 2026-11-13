import { describe, expect, it } from "vitest";
import { DEFAULT_PLAYER_ZONE, isPlayerZone, playerZoneForMirroredDisplay, readStoredPlayerZone } from "./player-zone";

describe("player-zone settings",()=>{
  it("maps asymmetric camera-space settings to the mirrored preview",()=>{expect(playerZoneForMirroredDisplay({minX:.15,maxX:.72,minY:.3,maxY:.81,minScale:.075})).toEqual({left:.28,right:.85,top:.3,bottom:.81,minScale:.075});});
  it("rejects crossed, out-of-range and unknown stored settings safely",()=>{expect(isPlayerZone({minX:.8,maxX:.2,minY:.2,maxY:.8,minScale:.1})).toBe(false);expect(isPlayerZone({minX:.2,maxX:.8,minY:.2,maxY:.8,minScale:Infinity})).toBe(false);expect(readStoredPlayerZone({getItem:()=>"not-json"})).toEqual(DEFAULT_PLAYER_ZONE);expect(readStoredPlayerZone({getItem:()=>JSON.stringify({minX:.2,maxX:.8,minY:.2,maxY:.8,minScale:.1,extra:true})})).toEqual({minX:.2,maxX:.8,minY:.2,maxY:.8,minScale:.1});});
});
