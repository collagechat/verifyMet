# VerifyMet — Technical Workflow (PPT-ready)

Paste the Mermaid blocks into mermaid.live (or any Mermaid PPT plugin) to
render clean diagrams for your slides. One diagram per slide.

---

## Slide 1 — System Architecture

```mermaid
flowchart LR
    subgraph Client["Client — Vercel"]
        WEB["Vite + React + Tailwind<br/>Owner · Officer · Admin screens"]
    end
    subgraph Edge["Edge — Cloudflare Workers"]
        API["Hono API<br/>role-guarded routes"]
    end
    FB[("Firebase Auth<br/>login + ID tokens")]
    DB[("Turso libSQL<br/>instruments · applications<br/>certificates · users · audit")]
    CD[("Cloudinary<br/>photos + documents")]

    WEB -->|"HTTPS + Bearer token"| API
    WEB -->|"email/password,<br/>getIdToken()"| FB
    API -->|"verify JWT (JWKS)"| FB
    API -->|"libSQL over HTTP"| DB
    WEB -->|"unsigned upload"| CD
    API -->|"stores secure_url"| DB
```

Say: "Three managed services, zero servers to maintain. The browser talks
to Workers; Workers trusts only Google-signed tokens; all state sits in
Turso."

---

## Slide 2 — Verification Workflow (the core journey)

```mermaid
flowchart TD
    A["Owner: registers instrument<br/>+ uploads documents"] --> B["Owner: submits application<br/>status = Submitted"]
    B --> C["Admin: assigns LMO / GATC"]
    C --> D["Officer: schedules inspection<br/>status = Scheduled"]
    D --> E["Owner: confirms schedule"]
    E --> F["Officer: field visit<br/>observed vs tolerance + photos"]
    F --> G{"Within tolerance?"}
    G -->|Yes| H["APPROVE → certificate<br/>VM-CERT-… issued"]
    G -->|No| I["REJECT with remarks<br/>status = Failed"]
    H --> J["Owner: receives certificate + QR"]
    J --> K["Anyone: scans QR → VALID page"]
```

Say: "One instrument, six steps, every transition recorded. This is the
slide that maps 1:1 to our live demo."

---

## Slide 3 — Auth & Role Enforcement

```mermaid
sequenceDiagram
    participant U as Browser
    participant F as Firebase
    participant W as Workers API
    participant D as Turso DB

    U->>F: email + password
    F-->>U: signed ID token (1 hr)
    U->>W: Bearer token + request
    W->>W: verify signature via Google JWKS
    W->>D: lookup role by email
    D-->>W: Owner / LMO / GATC / Admin
    W->>W: allow / block by route role
    W-->>U: data or 401 / 403
```

Say: "Passwords never touch our servers. Every API call re-verifies who
you are and what you're allowed to do — officers see only their queue,
admin pages reject everyone else, QR checks stay public."

---

## Slide 4 — Data Model (5 tables)

```mermaid
erDiagram
    users ||--o{ instruments : owns
    instruments ||--o{ applications : verified_by
    applications ||--|| certificates : issues
    users ||--o{ audit_logs : acts

    users {
        string uid PK
        string email
        string role
    }
    instruments {
        string id PK
        string type
        string serial
        string validUntil
        string documents
    }
    applications {
        string id PK
        string status
        string assignedOfficer
        string scheduledAt
        float observed
        float tolerance
        string photos
    }
    certificates {
        string certNo PK
        string verifyDate
        string validUntil
    }
    audit_logs {
        int id PK
        string actor
        string action
    }
```

Say: "Five tables cover the whole lifecycle — plus an audit log, so every
state change is traceable to a person and a timestamp."

---

## Slide 5 — Demo Script (60 seconds, live)

1. Register as owner → add instrument → apply (Submitted).
2. Login as admin → assign to LMO.
3. Login as LMO → schedule → record 500 vs 0.5 → Approve.
4. Back as owner → certificate + QR → scan → VALID.

Say: "Apply, schedule, inspect, verify, certify, track — all live, all on
the links in the guide."
