import type { Landmark } from "./pose";
import { describePose, type PoseDescriptor } from "./pose-selection";

export type PlayerCandidate={id:string;landmarks:Landmark[];descriptor:PoseDescriptor};
export type CandidateState={nextId:number;known:Array<{id:string;descriptor:PoseDescriptor;lastSeen?:number}>};
const distance=(a:PoseDescriptor,b:PoseDescriptor)=>Math.hypot(a.x-b.x,a.y-b.y)/Math.max(.08,(a.scale+b.scale)/2*1.8)+Math.abs(Math.log(a.scale/b.scale))*.35;

/** Stable per-camera candidate IDs. IDs are never derived from detector order. */
export function associateCandidates(state:CandidateState,landmarks:Landmark[][],now=Date.now()):{state:CandidateState;candidates:PlayerCandidate[]}{
  const incoming=landmarks.map(item=>({landmarks:item,descriptor:describePose(item)})).filter((item):item is {landmarks:Landmark[];descriptor:PoseDescriptor}=>!!item.descriptor),unused=new Set(state.known.map(item=>item.id));let nextId=state.nextId;
  const candidates=incoming.map(item=>{const match=state.known.filter(known=>unused.has(known.id)).map(known=>({known,score:distance(known.descriptor,item.descriptor)})).sort((a,b)=>a.score-b.score)[0];const id=match&&match.score<.7?match.known.id:`p${nextId++}`;unused.delete(id);return {id,...item};});
  const retained=state.known.filter(item=>now-(item.lastSeen??now)<=1_500&&!candidates.some(candidate=>candidate.id===item.id));
  return {state:{nextId,known:[...candidates.map(({id,descriptor})=>({id,descriptor,lastSeen:now})),...retained]},candidates};
}
