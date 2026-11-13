declare module "js-aruco2" {
  type Corner={x:number;y:number};
  type Marker={id:number;corners:Corner[]};
  type DetectorOptions={dictionaryName?:string;maxHammingDistance?:number};
  type Ar={
    DICTIONARIES:Record<string,{nBits:number;tau?:number|null;codeList:number[][]|number[]}>;
    Detector:new(options?:DetectorOptions)=>{detect(image:ImageData):Marker[]};
    Dictionary:new(name:string)=>{generateSVG(id:number):string};
  };
  const aruco:{AR:Ar};
  export default aruco;
}
