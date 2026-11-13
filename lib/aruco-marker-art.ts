import { arucoModule } from "./aruco-dictionary";
import { ARUCO_DICTIONARY, isPrintedMarkerId } from "./aruco-types";

export function markerSvg(id:number){
  if(!isPrintedMarkerId(id))throw new Error("invalid ArUco marker id");
  return new arucoModule.AR.Dictionary(ARUCO_DICTIONARY).generateSVG(id);
}

/** Rasterizes the same SVG sent to the print page for detector fixtures. */
export function rasterizeSvg(svg:string,modulePixels=20){
  const viewBox=svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  if(!viewBox)throw new Error("invalid marker svg");
  const modules=Number(viewBox[1]),width=modules*modulePixels,data=new Uint8ClampedArray(width*width*4).fill(255);
  for(const match of svg.matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" fill="(white|black)"\/>/g)){
    const [,x,y,w,h,fill]=match,value=fill==="black"?0:255;
    for(let row=Number(y)*modulePixels;row<(Number(y)+Number(h))*modulePixels;row++)for(let column=Number(x)*modulePixels;column<(Number(x)+Number(w))*modulePixels;column++){
      const offset=(row*width+column)*4;data[offset]=value;data[offset+1]=value;data[offset+2]=value;data[offset+3]=255;
    }
  }
  return {width,height:width,data};
}
export function rasterizeMarkerSvg(id:number,modulePixels=20){return rasterizeSvg(markerSvg(id),modulePixels);}
