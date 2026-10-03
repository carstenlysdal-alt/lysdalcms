import "server-only";
// Transport starter from knowledge-os commit 6a617ff.
/** Copy into the CMS BACKEND. No database imports, writes or browser credentials.
 * Legacy sandbox scope checks here do not provide remote tenant isolation.
 * Multi-tenant production requires the future authorised/versioned Knowledge OS API.
 */
export interface CmsKnowledgeScope { tenantId:string;instanceId:string }
export interface ResearchEvidence {
  nodeId:string;kind:string;origin:"raw"|"human"|"derived";text:string;
  source:{id:string;title:string;type:string}|null;
  verification:"unknown";contentTrust:"untrusted";
}
export interface CmsResearch {
  contractVersion:"cms-research.v0";
  status:"disabled"|"mock"|"available"|"unavailable";
  topic:string;evidence:ResearchEvidence[];
  contradictions:{claimA:string;claimB:string}[];
}
export type CmsKnowledgeConfig =
  | {mode:"disabled"}
  | {mode:"mock"}
  | {mode:"legacy-sandbox";baseUrl:string;apiKey:string;allowedScope:CmsKnowledgeScope;
      sandboxConfirmed:true;timeoutMs?:number};

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function record(value:unknown):Record<string,unknown> {
  if (!value||typeof value!=="object"||Array.isArray(value)) throw new Error("Invalid research response");
  return value as Record<string,unknown>;
}
function text(value:unknown,max=20000):string {
  if (typeof value!=="string"||value.length>max) throw new Error("Invalid research field");
  return value;
}
function id(value:unknown):string {
  const v=text(value,36);if (!uuid.test(v)) throw new Error("Invalid knowledge ID");return v;
}
function evidence(value:unknown):ResearchEvidence {
  const r=record(value);
  if (!["raw","human","derived"].includes(String(r.origin))) throw new Error("Invalid origin");
  const s=r.source==null?null:record(r.source);
  return {nodeId:id(r.nodeId),kind:text(r.kind,40),origin:r.origin as ResearchEvidence["origin"],text:text(r.text),
    source:s?{id:id(s.id),title:text(s.title,1000),type:text(s.type,40)}:null,
    verification:"unknown",contentTrust:"untrusted"};
}

export function createCmsKnowledgeAdapter(config:CmsKnowledgeConfig,fetcher:typeof fetch=fetch) {
  if (typeof window!=="undefined") throw new Error("Knowledge adapter must run on the CMS server");
  let base:URL|undefined;
  if (config.mode==="legacy-sandbox") {
    base=new URL(config.baseUrl);
    const loopback=["localhost","127.0.0.1","[::1]"].includes(base.hostname);
    if ((base.protocol!=="https:"&&!(base.protocol==="http:"&&loopback))||base.username||base.password||
        base.search||base.hash||base.pathname!=="/"||!config.apiKey.trim()||config.sandboxConfirmed!==true||
        !uuid.test(config.allowedScope.tenantId)||!uuid.test(config.allowedScope.instanceId)) {
      throw new Error("Explicit isolated sandbox origin, key and scope required");
    }
    if (config.timeoutMs!==undefined&&(!Number.isInteger(config.timeoutMs)||config.timeoutMs<1||config.timeoutMs>30000)) {
      throw new Error("Invalid Knowledge timeout");
    }
  }
  return {
    /** Caller authenticates editor and resolves this scope from trusted CMS membership.
     * Never pass a scope directly from request body/header. No auth/session lives here. */
    async research(scope:CmsKnowledgeScope,query:string):Promise<CmsResearch> {
      const topic=text(query,1000).trim();
      if (!topic||!uuid.test(scope.tenantId)||!uuid.test(scope.instanceId)) throw new Error("Valid scope and topic required");
      const empty=(status:CmsResearch["status"]):CmsResearch=>({contractVersion:"cms-research.v0",status,topic,evidence:[],contradictions:[]});
      if (config.mode==="disabled") return empty("disabled");
      if (config.mode==="mock") return {...empty("mock"),evidence:[{
        nodeId:"40000000-0000-4000-8000-000000000001",kind:"chunk",origin:"raw",
        text:"DEMODATA: Her vises redaktionens tidligere materiale. Dette er en fixture, ikke en virkelig kilde.",
        source:{id:"40000000-0000-4000-8000-000000000002",title:"Demo: tidligere materiale",type:"document"},
        verification:"unknown",contentTrust:"untrusted",
      }]};
      if (scope.tenantId!==config.allowedScope.tenantId||scope.instanceId!==config.allowedScope.instanceId) {
        throw new Error("Scope unavailable in this isolated legacy sandbox");
      }
      try {
        const url=new URL("/knowledge/context",base);url.searchParams.set("topic",topic);
        const res=await fetcher(url,{method:"GET",headers:{authorization:`Bearer ${config.apiKey}`},
          redirect:"error",cache:"no-store",signal:AbortSignal.timeout(config.timeoutMs??5000)});
        if (!res.ok) return empty("unavailable");
        const body=record(await res.json());
        if (!Array.isArray(body.relevantKnowledge)||body.relevantKnowledge.length>100||
            !Array.isArray(body.contradictions)||body.contradictions.length>100) throw new Error("Invalid context response");
        return {...empty("available"),evidence:body.relevantKnowledge.slice(0,20).map(evidence),
          contradictions:body.contradictions.map(v=>{
            const r=record(v);return {claimA:text(r.claimA),claimB:text(r.claimB)};
          })};
      } catch {return empty("unavailable");} // Never return raw remote errors/credentials to UI or logs.
    },
  };
}
