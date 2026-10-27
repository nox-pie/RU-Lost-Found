# Sequence, Activity and State Diagrams

Status: Built and live · Last updated: 27 October 2026

How control flows through the system for the core use cases of [requirements.md](requirements.md): which objects take part and in what order (sequence diagrams), the journeys from start to end with their decisions (activity diagrams), and the life of each object with a status (state diagrams). Participant names are the classes in [class-diagrams.md](class-diagrams.md).

Every request first passes the same middleware (request id, security headers, CORS, rate limits, authentication, Zod validation), drawn once in [A3](#a3-one-request-through-the-api) and left out of the sequence diagrams to keep them readable. A shaded box marks **one database transaction**: everything inside it commits together or not at all.

| Diagram                                                                      | Use case                            |
| ---------------------------------------------------------------------------- | ----------------------------------- |
| [Q1 Sign up](#q1-sign-up)                                                    | UC-1                                |
| [Q2 Sign in and refresh the session](#q2-sign-in-and-refresh-the-session)    | FR-2                                |
| [Q3 Report a found item, and matching](#q3-report-a-found-item-and-matching) | UC-2                                |
| [Q4 Claim an item](#q4-claim-an-item)                                        | UC-3                                |
| [Q5 Approve a claim](#q5-approve-a-claim)                                    | UC-4                                |
| [Q6 Hand over with the code](#q6-hand-over-with-the-code)                    | UC-5, UC-7                          |
| [Q7 Remove a reported post](#q7-remove-a-reported-post)                      | UC-6                                |
| [Q8 Delivering events (outbox)](#q8-delivering-events-outbox)                | all                                 |
| [A1 From lost to returned](#a1-from-lost-to-returned)                        | UC-2 to UC-5                        |
| [A2 Post lifecycle](#a2-post-lifecycle)                                      | FR-13, FR-14                        |
| [A3 One request through the API](#a3-one-request-through-the-api)            | all                                 |
| [S1 to S5 State diagrams](#state-diagrams)                                   | claim, item, report, session, event |

---

## Sequence diagrams

### Q1 Sign up

Three requests: ask for a code, prove it, create the account. The code is never stored, only its HMAC, and the answer to step 1 is the same whether or not the email has an account.

```mermaid
sequenceDiagram
    autonumber
    actor V as Visitor
    participant AC as AuthController
    participant AS as AuthService
    participant UR as UniversityRepository
    participant US as UserRepository
    participant OTP as OtpService
    participant KV as KeyValueStore (Redis)
    participant EM as EmailSender
    participant TK as TokenService
    participant SM as SessionManager

    V->>AC: POST /auth/otp {email, purpose: SIGNUP}
    AC->>AS: requestOtp(input)
    AS->>UR: findByEmail(email)
    alt domain not allowed
        AS-->>V: 400 "Please use your university email address."
    end
    AS->>US: findByEmail(email)
    alt account already exists
        AS->>OTP: throttle(purpose, email)
        AS-)EM: send "you already have an account" (in the background)
    else new address
        AS->>OTP: issue(purpose, email)
        OTP->>KV: set HMAC of the code, 10 min (one new code per minute)
        AS-)EM: send the 6-digit code (in the background)
    end
    AC-->>V: 202 Accepted (same answer either way)

    V->>AC: POST /auth/otp/verify {email, code}
    AC->>AS: verifyOtp(input)
    AS->>OTP: verify(purpose, email, code)
    OTP->>KV: count the attempt, compare the HMAC
    alt wrong or expired code
        OTP-->>V: 400 (after 5 tries the code is void, after 10 a day, 429)
    end
    OTP->>KV: delete the code
    AS->>TK: issueVerificationToken({email, purpose})
    AC-->>V: 200 {verificationToken (30 min), university schools}

    V->>AC: POST /auth/register {verificationToken, profile, password}
    AC->>AS: register(input, client)
    AS->>TK: verifyVerificationToken(token, SIGNUP)
    AS->>US: findByEmail(email)
    Note over AS: User.register(...) builds the aggregate and records UserRegistered
    AS->>US: create(user) (user + event in one transaction)
    AS->>SM: start(userId, client)
    SM-->>AS: refresh token (only its SHA-256 is stored)
    AS->>TK: issueAccessToken({sub, uid, role})
    AC-->>V: 201 {accessToken}, Set-Cookie: refresh token (httpOnly)
```

### Q2 Sign in and refresh the session

Access tokens last 15 minutes and live only in the page's memory; the refresh token is an `httpOnly` cookie and is **replaced on every use**. Presenting an already-replaced token again (after a 30-second grace window for racing tabs) means it was copied, so the whole family of sessions ends.

```mermaid
sequenceDiagram
    autonumber
    actor S as Student (browser)
    participant AC as AuthController
    participant AS as AuthService
    participant LT as LoginThrottle
    participant US as UserRepository
    participant PH as PasswordHasher
    participant SM as SessionManager
    participant SR as SessionRepository
    participant UW as UnitOfWork

    S->>AC: POST /auth/login {email, password}
    AC->>AS: login(input, client)
    AS->>LT: assertAllowed(email, ip)
    AS->>US: findByEmail(email)
    AS->>PH: verify(password, hash or a dummy hash)
    alt wrong email or password
        AS->>LT: recordFailure(email, ip)
        AS-->>S: 401 (one message for both, same timing)
    else suspended
        AS-->>S: 403
    end
    AS->>SM: start(userId, client)
    AC-->>S: 200 {accessToken}, Set-Cookie refresh

    Note over S: 15 minutes later, or after a reload
    S->>AC: POST /auth/refresh (cookie, Origin checked)
    AC->>AS: refresh(token, client)
    AS->>SM: rotate(token, client)
    SM->>SR: findByTokenHash(sha256(token))
    alt unknown token
        SM-->>S: 401, cookie cleared
    else already rotated, within 30 s, family still active
        SM->>SR: create(new session in the same family)
    else already rotated, after 30 s (theft)
        SM->>SR: endFamily(familyId, REUSE_DETECTED)
        SM-->>S: 401, cookie cleared, alert in the activity log
    else current session
        rect rgba(128, 128, 128, 0.12)
            SM->>UW: run(tx)
            UW->>SR: findByTokenHash (again, inside the transaction)
            Note over SM: current.rotateTo(next, now)
            UW->>SR: create(next)
            UW->>SR: update(current) (version check)
        end
    end
    AS->>US: findById(userId)
    opt account deleted or suspended since
        AS->>SM: endAll(userId, ACCOUNT_INACTIVE)
        AS-->>S: 401
    end
    AC-->>S: 200 {accessToken}, Set-Cookie new refresh token
```

### Q3 Report a found item, and matching

The photos are checked and cleaned before they are stored, the post and its `ItemReported` event are saved together, and matching runs later in the background, so the student's request never waits for it.

```mermaid
sequenceDiagram
    autonumber
    actor F as Finder
    participant MW as imageUpload middleware
    participant IC as ItemController
    participant IS as ItemService
    participant US as UserRepository
    participant UR as UniversityRepository
    participant SP as SanitizingStorageProvider
    participant SH as SharpImageProcessor
    participant CL as CloudinaryStorageProvider
    participant IR as MongoItemRepository
    participant OB as Outbox (outbox_events)

    F->>MW: POST /items (multipart: fields + 1 to 3 photos)
    Note over MW: limits on count and size, real type read from the first bytes
    MW->>IC: validated body + photos
    IC->>IS: report(actor, scope, input, photos)
    IS->>US: findById(actor) (active? not a demo account?)
    IS->>UR: findById(scope) then hasPlace(place)
    par each photo
        IS->>SP: upload(photo, "items")
        SP->>SH: sanitize(photo) (strip GPS, rotate, resize, WebP)
        SP->>CL: upload(clean photo)
        CL-->>IS: ImageRef {url, publicId}
    end
    Note over IS: Item.report(...) checks the rules and records ItemReported
    rect rgba(128, 128, 128, 0.12)
        IS->>IR: create(item)
        IR->>IR: insert item (version 1)
        IR->>OB: append(ItemReported)
    end
    alt an upload or the save failed
        IS->>SP: delete(each stored photo) (compensating action)
        IS-->>F: error
    end
    IC-->>F: 201 Created, Location /items/:id

    Note over OB: moments later, in the background worker (Q8)
    participant TO as TellOwnersOfLikelyFinds
    participant MS as MatchingService
    participant NS as NotificationService
    OB->>TO: handle(ItemReported)
    TO->>MS: strongMatchesFor(scope, found)
    Note over MS: up to 50 open lost posts of the same category, each scored by matchScore()
    loop up to 3 strong matches
        TO->>NS: notify(owner of the lost post, POSSIBLE_MATCH, email)
    end
```

### Q4 Claim an item

```mermaid
sequenceDiagram
    autonumber
    actor O as Owner
    participant CC as ClaimController
    participant CS as ClaimService
    participant IR as ItemRepository
    participant US as UserRepository
    participant CR as ClaimRepository
    participant C as Claim

    O->>CC: POST /items/:id/claims {message, answers, sharePhone}
    CC->>CS: submit(actor, scope, itemId, input)
    CS->>IR: findById(scope, itemId)
    alt missing or removed
        CS-->>O: 404
    end
    CS->>US: findByIds([actor, reporter])
    alt actor suspended
        CS-->>O: 401
    else demo account on a real post
        CS-->>O: 403
    end
    CS->>CR: wasRejectedByReporter(scope, itemId, actor)
    alt declined before
        CS-->>O: 403
    end
    CS->>C: Claim.submit({item, claimant, answers, ...})
    Note over C: own post: 403 · item not OPEN: 409 · every question answered once, else 400 · records ClaimRequested
    CS->>CR: create(claim) (claim + ClaimRequested in one transaction)
    alt already an active claim on this item
        CR-->>O: 409 (unique index uniq_active_claim_per_claimant)
    end
    CC-->>O: 201 ClaimDto (the reporter's contact details not included)
    Note over CR: the worker then tells the reporter (ClaimNotificationHandler), in the app and by email
```

### Q5 Approve a claim

```mermaid
sequenceDiagram
    autonumber
    actor R as Reporter (or desk staff)
    participant CC as ClaimController
    participant CS as ClaimService
    participant UW as UnitOfWork
    participant CR as ClaimRepository
    participant IR as ItemRepository
    participant C as Claim
    participant ST as ClaimState
    participant I as Item

    R->>CC: POST /claims/:id/approve {sharePhone}
    CC->>CS: approve(actor, scope, claimId, input)
    rect rgba(128, 128, 128, 0.12)
        CS->>UW: run(tx)
        UW->>CR: findById(scope, claimId, tx)
        UW->>IR: findById(scope, itemId, tx)
        opt desk item and actor is not the reporter
            CS->>CS: decider(): re-read the role from the database
        end
        CS->>C: approve(decider, {code, deadline: +7 days}, now, {atDesk})
        C->>C: requireDecider (reporter, or staff for a desk item, never own claim)
        C->>ST: approve()
        alt not REQUESTED
            ST-->>R: 409 INVALID_STATE_TRANSITION
        end
        ST-->>C: APPROVED
        Note over C: handover set, history entry added, ClaimApproved recorded
        alt item not OPEN (another claim approved)
            CS-->>R: 409
        end
        CS->>I: reserve(now)
        UW->>CR: update(claim, tx) (only if version unchanged)
        UW->>IR: update(item, tx)
        Note over UW: ClaimApproved goes to the outbox in the same transaction
    end
    alt someone saved the claim or item meanwhile
        UW-->>R: 409 CONFLICT, "changed by someone else"
    end
    CC-->>R: 200 ClaimDto (now with the claimant's contact details)
    Note over CR: the worker tells the owner, with the handover code (or "collect it at the desk")
```

### Q6 Hand over with the code

A wrong code is **saved, not thrown**, inside the transaction, so a retry can't reset the count; the error is raised only after the commit.

```mermaid
sequenceDiagram
    autonumber
    actor F as Finder
    actor D as Desk staff
    participant CC as ClaimController
    participant CS as ClaimService
    participant UW as UnitOfWork
    participant CR as ClaimRepository
    participant IR as ItemRepository
    participant C as Claim
    participant I as Item

    F->>CC: POST /claims/:id/handover {code}
    CC->>CS: confirmHandover(actor, scope, claimId, code)
    rect rgba(128, 128, 128, 0.12)
        CS->>UW: run(tx)
        UW->>CR: findById + item
        CS->>C: completeHandover(actor, code, now)
        Note over C: only the finder · state must allow it · deadline not passed
        alt code right
            C-->>CS: COMPLETED (ClaimCompleted recorded)
            CS->>I: resolve(now) (ItemResolved recorded)
            UW->>CR: update(claim)
            UW->>IR: update(item)
            UW->>CR: findActiveByItem(item)
            loop every other active claim
                CS->>C: rejectAutomatically("handed over to someone else")
                UW->>CR: update(other)
            end
        else code wrong
            C-->>CS: WRONG_CODE or LOCKED (failedAttempts + 1)
            UW->>CR: update(claim) (the attempt is saved)
        end
    end
    alt WRONG_CODE
        CS-->>F: 400 HANDOVER_CODE_INCORRECT, attempts left
    else LOCKED (5th wrong code)
        CS->>CS: audit HANDOVER_LOCKED
        CS-->>F: 409 HANDOVER_LOCKED
    end
    CC-->>F: 200 ClaimDto (COMPLETED)

    Note over D: when the code is locked, or for an item held at the desk
    D->>CC: POST /claims/:id/handover/staff
    CC->>CS: confirmHandoverAsStaff(actor, scope, claimId)
    CS->>CS: currentActor(): role re-read from the database
    rect rgba(128, 128, 128, 0.12)
        CS->>C: completeHandoverAsStaff(staff, now)
        Note over C: staff only, never a party to the claim
        CS->>CS: finishHandover (as above)
    end
    CC-->>D: 200 ClaimDto (COMPLETED, confirmed by staff)
```

### Q7 Remove a reported post

The admin's decision changes the post and its reports in one transaction. Everything that follows (claims closed, poster told, activity logged) happens through events, so the moderation module calls no other module.

```mermaid
sequenceDiagram
    autonumber
    actor A as Admin
    participant MC as ModerationController
    participant MS as ModerationService
    participant UW as UnitOfWork
    participant RR as ModerationReportRepository
    participant IR as ItemRepository
    participant OB as Outbox
    participant CL as CloseClaimsWhenItemEnds
    participant IM as ItemModerationHandler
    participant AU as AuditEventHandler

    A->>MC: POST /admin/items/:id/moderation {decision: REMOVE_ITEM, note}
    Note over MC: authorizeCurrent: the admin role is re-read from the database
    MC->>MS: moderateItem(actor, scope, itemId, input)
    rect rgba(128, 128, 128, 0.12)
        MS->>UW: run(tx)
        UW->>RR: findOpenForItem(scope, itemId)
        alt no open report
            MS-->>A: 404
        end
        UW->>IR: findById(scope, itemId)
        Note over MS: item.remove(admin, now, note) records ItemRemoved
        UW->>IR: update(item)
        loop each open report
            Note over MS: report.resolve(REMOVE_ITEM, admin, note, now) records ReportResolved
            UW->>RR: update(report)
        end
    end
    MC-->>A: 200 {resolved: n}

    Note over OB: background worker
    OB->>CL: ItemRemoved: cancel the post's active claims (their claimants are told)
    OB->>IM: ItemRemoved: tell the poster why (in the app and by email)
    OB->>AU: ItemRemoved, ReportResolved: write the activity log
```

### Q8 Delivering events (outbox)

The background worker, in the API process or on its own. Delivery is **at least once**; handlers are written to be safe when repeated.

```mermaid
sequenceDiagram
    autonumber
    participant BW as BackgroundWorker
    participant OP as OutboxProcessor
    participant OB as MongoOutbox
    participant REG as EventHandlerRegistry
    participant H as EventHandler(s)

    loop every 2 seconds
        BW->>OP: processBatch(50)
        loop until none ready
            OP->>OB: claimNext(now, lease 60 s)
            Note over OB: one atomic findOneAndUpdate: PENDING and due, or a lease that ran out
            OB-->>OP: event (or none)
            OP->>REG: handlersFor(event.type)
            loop each handler not yet in completedHandlers
                OP->>H: handle(event)
                alt succeeded
                    OP->>OB: markHandlerDone(event, handler)
                else failed
                    Note over OP: remembered, the other handlers still run
                end
            end
            alt all succeeded
                OP->>OB: complete(event) (DONE, deleted after 7 days)
            else failed, attempts below 5
                OP->>OB: retryLater(event, 30 s · 2^(attempt-1))
            else 5th failure
                OP->>OB: fail(event) (kept, reported to Sentry)
            end
        end
    end
```

---

## Activity diagrams

### A1 From lost to returned

The whole journey, one lane per person and one for the system. Diamonds are decisions.

```mermaid
flowchart TB
    subgraph Owner
        O1([Loses an item]) --> O2[Reports it lost]
        O3[Gets a 'may have found' notification<br/>or finds the post by search] --> O4[Claims it, answering the questions]
        O6[Sees the handover code]
        O7[Meets the finder, shows the code]
        O9[Collects it at the desk with student ID]
    end

    subgraph Finder
        F1([Finds an item]) --> F2[Reports it found,<br/>adds questions only the owner can answer]
        F3{Answers convincing?}
        F5[Enters the owner's code]
    end

    subgraph System
        S1[Saves the post, cleans the photos]
        S2[Scores open lost posts<br/>against the find]
        S3[Saves the claim, tells the finder]
        S4[Approves: reserves the item,<br/>creates the code, shares contacts]
        S5[Declines: tells the owner]
        S6{Code right?}
        S7[Counts the attempt]
        S8{5 wrong codes?}
        S9[Locks the code]
        S10[Completes the claim, item returned,<br/>other claims declined, both told]
        S11{Handed over<br/>within 7 days?}
        S12[Expires the claim, item back on offer]
    end

    subgraph Desk[Security desk]
        D1[Confirms the handover in person]
    end

    O2 --> S1
    F2 --> S1
    S1 --> S2 --> O3
    O4 --> S3 --> F3
    F3 -- yes --> S4 --> O6 --> O7 --> F5 --> S6
    F3 -- no --> S5 --> End1([Owner may look further])
    S6 -- yes --> S10 --> End2([Returned])
    S6 -- no --> S7 --> S8
    S8 -- no --> F5
    S8 -- yes --> S9 --> O9 --> D1 --> S10
    S4 -.-> S11
    S11 -- no --> S12 --> End3([Back on offer])
```

### A2 Post lifecycle

What happens to a post over time, including the hourly job that reminds and closes.

```mermaid
flowchart TB
    Start([Reporter publishes a post]) --> Open[OPEN, expires in 60 days]
    Open --> Q1{What happens next?}
    Q1 -- a claim is approved --> Reserved[RESERVED]
    Reserved --> Q2{Handover?}
    Q2 -- code or desk confirms --> Resolved([RESOLVED: returned])
    Q2 -- cancelled or 7 days pass --> Open
    Q1 -- reporter: 'I got it back' or 'no longer needed' --> Closed[CLOSED, its open claims closed]
    Q1 -- reporter or admin removes it --> Removed[REMOVED, hidden, kept for moderation]
    Removed --> Purge[After 30 days: photos deleted]
    Q1 -- time passes --> Job{Hourly job:<br/>a week before expiry?}
    Job -- yes, not reminded yet --> Remind[Remind the reporter<br/>in the app and by email]
    Remind --> Q3{Reporter presses<br/>'Keep it open'?}
    Q3 -- yes --> Open
    Q3 -- no, a week passes --> Expire[CLOSED, reason EXPIRED]
    Closed --> Q4{Reporter keeps it open?}
    Expire --> Q4
    Q4 -- yes --> Open
    Q4 -- no --> End([Stays in My items])
```

### A3 One request through the API

Every request takes this path; the error handler turns any failure into the same JSON format. This is where validation, rate limits and errors are handled once for the whole API.

```mermaid
flowchart TB
    In([HTTP request]) --> Id[Request id + JSON log line]
    Id --> Sec[Security headers, CORS allow-list]
    Sec --> Body{Body parses<br/>and is small enough?}
    Body -- no --> E400[400 / 413]
    Body -- yes --> Cap{Write over the<br/>per-IP cap?}
    Cap -- yes --> E429[429 + Retry-After]
    Cap -- no --> Route{Route exists?}
    Route -- no --> E404[404]
    Route -- yes --> Auth{Needs sign-in?<br/>Valid access token?}
    Auth -- invalid --> E401[401]
    Auth -- ok --> Role{Role allowed?<br/>admin: re-read from database}
    Role -- no --> E403[403]
    Role -- yes --> Limit{Per-user or per-email<br/>limit reached?}
    Limit -- yes --> E429
    Limit -- no --> Val{Zod: params, query,<br/>body valid?}
    Val -- no --> E400V[400 VALIDATION_ERROR<br/>with field details]
    Val -- yes --> Ctl[Controller → Service → Domain → Repository]
    Ctl --> Ok{Succeeded?}
    Ok -- yes --> Res([2xx JSON DTO])
    Ok -- AppError --> Map[Status and code of the error:<br/>400, 401, 403, 404, 409, 413, 429, 502, 503]
    Ok -- anything else --> E500[500 with a generic message;<br/>details to logs and Sentry]
    E400 --> Out([Error JSON: code, message, requestId])
    E429 --> Out
    E404 --> Out
    E401 --> Out
    E403 --> Out
    E400V --> Out
    Map --> Out
    E500 --> Out
```

---

## State diagrams

### S1 Claim

Implemented with the State pattern (`ClaimState`): each state allows only the arrows leaving it, anything else is `InvalidStateTransitionError` (409).

```mermaid
stateDiagram-v2
    [*] --> REQUESTED : submit (claimant)
    REQUESTED --> APPROVED : approve (reporter, or desk staff for a desk item)
    REQUESTED --> REJECTED : reject (same), or automatically when another claim completes
    REQUESTED --> CANCELLED : cancel (either person), or the item is removed or closed
    APPROVED --> COMPLETED : right code (finder), or staff confirm
    APPROVED --> CANCELLED : cancel (either person), or the item is removed
    APPROVED --> EXPIRED : 7 days pass (scheduler)
    REJECTED --> [*]
    CANCELLED --> [*]
    EXPIRED --> [*]
    COMPLETED --> [*]
```

### S2 Item

Guarded by `Item` itself (`requireStatus`): edit, close and reserve only while `OPEN`, reopen and resolve only from `RESERVED`.

```mermaid
stateDiagram-v2
    [*] --> OPEN : report
    OPEN --> RESERVED : a claim is approved
    RESERVED --> OPEN : the approved claim is cancelled or expires
    RESERVED --> RESOLVED : handover confirmed
    OPEN --> CLOSED : reporter closes (RETURNED, WITHDRAWN) or expiry (EXPIRED)
    CLOSED --> OPEN : keep open
    OPEN --> REMOVED : reporter or admin removes
    RESERVED --> REMOVED
    RESOLVED --> REMOVED : admin removes
    CLOSED --> REMOVED
    RESOLVED --> [*]
    REMOVED --> [*] : photos deleted after 30 days
```

### S3 Moderation report

```mermaid
stateDiagram-v2
    [*] --> OPEN : flagged (once per person per post)
    OPEN --> ACTIONED : admin removes the post
    OPEN --> DISMISSED : admin keeps the post
    ACTIONED --> [*]
    DISMISSED --> [*]
```

### S4 Session (refresh token)

```mermaid
stateDiagram-v2
    [*] --> Active : sign-in or sign-up
    Active --> Ended : rotated (a new session replaces it)
    Active --> Ended : sign-out, password change, suspension, theft detected
    Active --> Expired : 7 days without use
    Ended --> Ended : replayed within 30 s while the family is active (a new token is issued)
    Ended --> [*] : replayed later, so the whole family ends (theft)
    Expired --> [*] : deleted by the TTL index
```

### S5 Outbox event

```mermaid
stateDiagram-v2
    [*] --> PENDING : saved with the change
    PENDING --> PROCESSING : claimed by a worker (60 s lease)
    PROCESSING --> DONE : every handler succeeded
    PROCESSING --> PENDING : a handler failed, retry later (30 s, 1 min, 2 min, 4 min)
    PROCESSING --> PENDING : lease ran out (worker crashed)
    PROCESSING --> FAILED : 5th failed attempt
    DONE --> [*] : deleted after 7 days
    FAILED --> [*] : kept for inspection
```
