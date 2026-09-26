# VerifyMet — Technical Workflow (ONE slide)

Render at mermaid.live, screenshot into your PPT.

```mermaid
flowchart TB
    OW(["Owner"]) & OF(["Officer LMO/GATC"]) & AD(["Admin"]) & PB(["Public QR scan"]) --> WEB["Vercel Web<br/>Vite · React · Tailwind"]
    WEB -->|Bearer JWT| API["Cloudflare Workers<br/>Hono API · role-guarded routes"]
    API <--> FB["Firebase Auth<br/>login + token verify"]
    API <--> DB[("Turso<br/>instruments · applications<br/>certificates · users · audit")]
    WEB --> CL["Cloudinary<br/>photo uploads"]
    WEB --> P1["1 · Apply<br/>owner + documents"] --> P2["2 · Assign<br/>admin → officer"] --> P3["3 · Schedule<br/>officer sets date"] --> P4["4 · Inspect<br/>observed vs tolerance"] --> P5{"5 · Pass?"}
    P5 -->|Yes| P6["6 · Certificate<br/>VM-CERT + QR"]
    P5 -->|No| P7["Rejected<br/>with remarks"]
    P6 --> P8["7 · VALID<br/>public QR page"]
```

Say: "Four actors use one web app; every call carries a Firebase token
that Workers verifies before touching Turso; photos go to Cloudinary;
the instrument flows Apply → Assign → Schedule → Inspect → Certificate
→ QR, with every step audit-logged."
