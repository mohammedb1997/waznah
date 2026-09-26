# Arena public review bundle

Task: TEAM-ORCH-ARENA-WEB-SMOKE-V1
Exact source_ref: 467bf8742b7556393629de157f5be061cddae970

This file contains only the curated source material explicitly approved for external Arena review. It is not a full repository export.

## Provenance
- 01. docs/contracts/classic-v0.1/CONTRACT.md lines 205-380
- 02. docs/contracts/classic-v0.1/CONTRACT.md lines 470-560
- 03. src/api/realtime-routes.ts
- 04. src/modules/games/realtime-registry.ts
- 05. src/modules/games/session-lifecycle-service.ts lines 720-855
- 06. src/modules/games/session-projection.ts
- 07. tests/realtime.test.ts
- 08. tests/realtime.integration.test.ts

## Review prompt

# TEAM-ORCH-ARENA-WEB-SMOKE-V1

You are one of two independent models selected explicitly in Arena Web Side-by-Side mode.

This is a non-blocking browser-pipeline smoke test against the already completed Classic Gate D
realtime implementation. Do not modify code and do not claim that this review changes the
existing Gate D decision.

Review only the exact source_ref supplied in the source bundle.

Focus on:

- HELLO authentication before subscription
- PostgreSQL-derived role authority
- Host / Player / Display projection secrecy
- process-local realtime registry behavior
- reconnect/disconnect status behavior within the supplied scope
- strict Gate D versus Gate E/F boundary
- whether the supplied tests support the implementation claims

Return exactly one self-contained Markdown report:

# TEAM-ORCH-ARENA-WEB-SMOKE-V1 worker report

## Reviewed source

State the exact reviewed source_ref.

## Result

APPROVED or CHANGES REQUESTED

## Findings

- P0: ...
- P1: ...
- P2: ...
- P3: ...

## Evidence

Cite exact supplied files/functions/tests.

## Scope assessment

State whether the compact source bundle was sufficient for this smoke review.

## Handoff to ChatGPT

State that this is a supplemental, non-blocking Arena Web review and that ChatGPT must
compare both model outputs against the exact source before taking any action.



---

# SOURCE 01: docs/contracts/classic-v0.1/CONTRACT.md lines 205-380

### 5. Display admission

`POST /api/v1/sessions/:sessionId/displays`

This is a Host-authorized lifecycle action. It uses the Host participant credentials
and an `Idempotency-Key`; it is not a gameplay command. The request may contain an
optional display label for Host administration.

Server transaction:

1. verify the caller is the Host participant for the session
2. require a session state in which a Display may be admitted
3. create one `session_participants` record with role `display`
4. generate at least 256 random bits of opaque resume token material
5. persist only its verifier/hash on that participant record
6. persist the idempotent lifecycle response atomically

The response returns the Display participant public id and raw `resumeToken` exactly
once. A Host may issue more than one Display credential only when the product policy
explicitly permits multiple displays; each credential is a separately revocable
participant. The API MUST NOT expose a public join URL, a bearer token in a query
string, or an anonymous Display fallback in v0.1.

Display uses the ordinary Snapshot endpoint and WebSocket `HELLO` with its own
participant id and resume token. PostgreSQL loads the `display` role after credential
verification; the client cannot request or elevate a role.

## Role/command matrix

Host:

- START_GAME
- START_ROUND
- SELECT_QUESTION
- REVEAL_QUESTION
- JUDGE_ANSWER
- END_TURN
- END_ROUND
- END_GAME

Player:

- SUBMIT_ANSWER

Display:

- no mutating gameplay commands in v0.1
- no lifecycle or credential-issuing commands

Authorization is checked before `decide()`.

## Question -> Judge -> Score flow

For the first slice:

1. Host sends `START_GAME`
2. Host sends `START_ROUND`
3. Host selects a synthetic `questionRevisionId`
4. server snapshots immutable question content into `session_question_usages`
5. Host sends `REVEAL_QUESTION`
6. Player sends `SUBMIT_ANSWER`
7. server persists `answer_submissions`
8. Host sends `JUDGE_ANSWER`
9. runtime emits `ANSWER_JUDGED` and, when applicable, `SCORE_AWARDED`
10. score event is persisted in `score_events`
11. `session_teams.score_cache` or participant projection is updated transactionally
12. new authoritative snapshot is persisted and broadcast

Client-supplied absolute scores are forbidden.

## Projection rules

### Host

May receive:

- room/session state
- participant/team identities
- score state
- revealed question prompt
- judging material only when the phase requires Host judgment

### Player

May receive:

- room/session state
- public participant/team data
- own participant identity
- score state
- revealed question prompt/options/hints allowed by the mode

Must not receive the canonical answer during an active question.

### Display

Read-only public projection:

- phase
- board/question display material
- teams/scores
- public participant names where configured

Must not receive reconnect tokens, hidden answers, internal command metadata, or
private account data.

## WebSocket contract

Endpoint remains:

`WS /api/v1/realtime`

The connection is unauthenticated until the first frame.

Client first frame:

```json
{
  "type": "HELLO",
  "sessionId": "session-public-id",
  "participantId": "participant-public-id",
  "resumeToken": "opaque-secret",
  "lastSequence": 42
}
```

Server verifies the session participant and token before subscribing the socket.
For a Display, this verification proves only the read-only `display` participant
record; any client frame that attempts a gameplay command is rejected and does not
reach `decide()`.

Successful server response:

```json
{
  "type": "SNAPSHOT",
  "sequence": 42,
  "snapshot": {}
}
```

v0.1 rule: send a fresh authoritative role-safe snapshot on initial connect,
reconnect, and after every successful state-changing command.

Event-delta catch-up is explicitly deferred until this snapshot-first path is proven.

The existing `ping` -> `pong` behavior may remain as a transport health check.

## Reconnect contract

Reconnect MUST:

1. reuse the same participant record
2. verify participant public id + resume token
3. never create a duplicate participant
4. mark connection status online only after successful verification
5. return an authoritative snapshot with monotonic sequence
6. preserve score and current phase across disconnect/reconnect
7. work after API process restart using PostgreSQL state
8. reject wrong/revoked token without leaking participant/session secrets

For v0.1, `lastSequence` is advisory. The server always sends a full snapshot.
Delta replay can be added only after snapshot recovery is reliable.

## Durable SessionStore requirement

Implement `PostgresSessionStore` behind the existing `SessionStore` interface.

`load(sessionId)`:

- read/lock canonical session metadata as needed
- load latest snapshot
- replay later runtime events if any
- return state + version

`append(sessionId, expectedVersion, events, nextState)` runs in one transaction:


---

# SOURCE 02: docs/contracts/classic-v0.1/CONTRACT.md lines 470-560

- Display projection
- secrecy tests

### Gate D — realtime

- HELLO verification
- session-scoped connection registry
- role-safe SNAPSHOT broadcast
- disconnect status

### Gate E — gameplay

- start
- round
- select/reveal synthetic question
- submit
- judge
- score
- persisted snapshot

### Gate F — reconnect/restart

- disconnect/reconnect
- wrong-token rejection
- process restart
- score/phase recovery

## Required test matrix

Unit:

- command phase validation
- role/command authorization
- projection secrecy
- request hashing/idempotency comparison
- reconnect-token verifier
- durable command ledger uniqueness for `(session_id, command_id)`
- same `commandId` with a different HTTP `Idempotency-Key` returns the original
  command result and creates no second score
- same `commandId` with changed participant/type/payload is rejected
- Display admission creates a `display` participant and returns its token once

PostgreSQL integration:

- Host Create transaction
- Player Join transaction
- duplicate idempotency key
- stale state-version writer
- contiguous sequence allocation
- score event + cache consistency
- snapshot reconstruction

Realtime integration:

- HELLO accepts valid participant
- HELLO rejects wrong token
- Display HELLO accepts a valid Display credential and receives only the Display
  projection
- wrong Display token is rejected without a projection
- Display gameplay-command frame is rejected and has no state effect
- two clients receive role-safe snapshots
- command result broadcasts new sequence
- reconnect returns current snapshot
- process restart returns same score/phase

End-to-end acceptance:

1. Host creates room
2. Player joins by room code
3. both receive sequence 0/initial lobby projection
4. Host starts game/round and reveals synthetic question
5. Player submits answer
6. Host judges correct
7. score changes exactly once
8. repeat command with same HTTP idempotency key does not double-score
9. repeat `JUDGE_ANSWER` with the same `commandId` and a different HTTP key does not
   double-score
10. Host admits a Display; valid Display reconnect receives only read-only projection
11. invalid Display token and Display gameplay command are rejected
12. Player disconnects
13. Player reconnects with same participant identity
14. current score/phase are restored
15. API restart still reconstructs the same state

## Data policy for this slice

Use 20-50 synthetic questions only.

Do not import the real raw question corpus into this implementation task.
Real data staging starts only after the runtime, persistence, reconnect, and
idempotency acceptance gates are green.


---

# SOURCE 03: src/api/realtime-routes.ts

import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import {
  createSnapshotBroadcaster,
  SessionConnectionRegistry,
  snapshotFrame,
  type RealtimeConnection,
  type RealtimeConnectionInput,
  type RoleSafeSnapshotProvider,
  type SnapshotBroadcaster,
} from "../modules/games/realtime-registry.js";
import {
  SessionLifecycleService,
} from "../modules/games/session-lifecycle-service.js";
import type {
  SessionProjection,
  SessionProjectionRole,
} from "../modules/games/session-projection.js";

const SOCKET_OPEN = 1;
const POLICY_VIOLATION_CLOSE = 1008;
const INTERNAL_ERROR_CLOSE = 1011;

const helloFrameSchema = z.strictObject({
  type: z.literal("HELLO"),
  sessionId: z.string().min(1).max(200),
  participantId: z.string().min(1).max(200),
  resumeToken: z.string().min(1).max(4096),
  // Advisory only in v0.1: the server always answers with a fresh full snapshot.
  lastSequence: z.number().int().nonnegative().optional(),
});

type HelloFrame = z.infer<typeof helloFrameSchema>;

export interface RealtimeSessionAccess {
  verifyRealtimeCredential(
    sessionPublicId: string,
    participantPublicId: string,
    resumeToken: string,
  ): Promise<{ role: SessionProjectionRole; snapshot: SessionProjection }>;
  getRoleSafeSnapshot(
    sessionPublicId: string,
    participantPublicId: string,
  ): Promise<SessionProjection>;
  setParticipantConnectionStatus(
    sessionPublicId: string,
    participantPublicId: string,
    status: "online" | "offline",
  ): Promise<void>;
}

export function createRealtimeSessionAccess(
  pool: Pool,
  resumeTokenKey: string,
): RealtimeSessionAccess {
  const lifecycle = new SessionLifecycleService(pool, resumeTokenKey);
  return {
    verifyRealtimeCredential: (sessionPublicId, participantPublicId, resumeToken) =>
      lifecycle.verifyRealtimeCredential(
        sessionPublicId,
        participantPublicId,
        resumeToken,
      ),
    getRoleSafeSnapshot: (sessionPublicId, participantPublicId) =>
      lifecycle.getRoleSafeSnapshot(sessionPublicId, participantPublicId),
    setParticipantConnectionStatus: (
      sessionPublicId,
      participantPublicId,
      status,
    ) =>
      lifecycle.setParticipantConnectionStatus(
        sessionPublicId,
        participantPublicId,
        status,
      ),
  };
}

export interface RealtimeRouteHandle {
  registry: SessionConnectionRegistry;
  broadcaster: SnapshotBroadcaster;
}

interface SocketLike {
  readonly readyState: number;
  send(payload: string): void;
  close(code?: number, reason?: string): void;
  on(event: "message", listener: (data: unknown) => void): unknown;
  on(event: "close", listener: () => void): unknown;
}

interface AuthenticatedConnection {
  sessionId: string;
  participantId: string;
  connection: RealtimeConnection;
}

type ErrorFrameCode =
  | "INVALID_HELLO"
  | "INVALID_SESSION_CREDENTIAL"
  | "UNSUPPORTED_FRAME"
  | "HANDSHAKE_IN_PROGRESS"
  | "REALTIME_UNAVAILABLE";

const ERROR_MESSAGES: Record<ErrorFrameCode, string> = {
  INVALID_HELLO: "First frame must be a valid HELLO",
  INVALID_SESSION_CREDENTIAL: "Invalid session credential",
  UNSUPPORTED_FRAME: "Frame type is not supported in this phase",
  HANDSHAKE_IN_PROGRESS: "A HELLO handshake is already in progress",
  REALTIME_UNAVAILABLE: "Realtime session state could not be updated",
};

function frameText(data: unknown): string {
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf8");
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  return String(data ?? "");
}

function parseJsonObject(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/**
 * Serializes connection-status writes per participant so a disconnect racing a
 * reconnect cannot persist a stale status: operations run in the order the
 * registry observed them, and the last write for a participant wins.
 */
function createStatusSerializer(access: RealtimeSessionAccess) {
  const queues = new Map<string, Promise<void>>();

  function enqueue(
    sessionId: string,
    participantId: string,
    status: "online" | "offline",
  ): Promise<void> {
    const key = `${sessionId}\u0000${participantId}`;
    const pending = queues.get(key) ?? Promise.resolve();
    const result = pending.then(() =>
      access.setParticipantConnectionStatus(sessionId, participantId, status),
    );
    const chained = result.catch(() => undefined);
    queues.set(key, chained);
    void chained.then(() => {
      if (queues.get(key) === chained) queues.delete(key);
    });
    return result;
  }

  return { enqueue };
}

function sendErrorFrame(socket: SocketLike, code: ErrorFrameCode): void {
  if (socket.readyState !== SOCKET_OPEN) return;
  socket.send(JSON.stringify({ type: "ERROR", code, message: ERROR_MESSAGES[code] }));
}

export async function registerRealtimeRoutes(
  app: FastifyInstance,
  access: RealtimeSessionAccess,
): Promise<RealtimeRouteHandle> {
  const registry = new SessionConnectionRegistry();
  const statusSerializer = createStatusSerializer(access);

  const provider: RoleSafeSnapshotProvider = async (request) => {
    const snapshot = await access.getRoleSafeSnapshot(
      request.sessionPublicId,
      request.participantId,
    );
    return { sequence: snapshot.sequence, snapshot };
  };
  const broadcaster = createSnapshotBroadcaster(registry, provider);

  app.get("/api/v1/realtime", { websocket: true }, (socket: SocketLike) => {
    let authenticated: AuthenticatedConnection | null = null;
    let handshakeSealed = false;

    const rejectAndClose = (code: ErrorFrameCode): void => {
      sendErrorFrame(socket, code);
      if (socket.readyState === SOCKET_OPEN) {
        socket.close(POLICY_VIOLATION_CLOSE, code);
      }
    };

    const registerAuthenticated = (
      hello: HelloFrame,
      role: SessionProjectionRole,
    ): RealtimeConnectionInput => ({
      participantId: hello.participantId,
      role,
      send: (payload: string) => {
        if (socket.readyState === SOCKET_OPEN) socket.send(payload);
      },
    });

    async function authenticate(hello: HelloFrame): Promise<void> {
      let verified: { role: SessionProjectionRole; snapshot: SessionProjection };
      try {
        verified = await access.verifyRealtimeCredential(
          hello.sessionId,
          hello.participantId,
          hello.resumeToken,
        );
      } catch {
        rejectAndClose("INVALID_SESSION_CREDENTIAL");
        return;
      }

      if (socket.readyState !== SOCKET_OPEN) return;

      const connection = registry.register(
        hello.sessionId,
        registerAuthenticated(hello, verified.role),
      );
      authenticated = {
        sessionId: hello.sessionId,
        participantId: hello.participantId,
        connection,
      };

      try {
        await statusSerializer.enqueue(
          hello.sessionId,
          hello.participantId,
          "online",
        );
      } catch {
        authenticated = null;
        registry.unregister(hello.sessionId, connection.id);
        rejectAndClose("REALTIME_UNAVAILABLE");
        return;
      }

      if (socket.readyState === SOCKET_OPEN) {
        socket.send(snapshotFrame(verified.snapshot.sequence, verified.snapshot));
      }
    }

    socket.on("message", (data: unknown) => {
      const raw = frameText(data);
      if (raw === "ping") {
        if (socket.readyState === SOCKET_OPEN) socket.send("pong");
        return;
      }

      if (!authenticated) {
        if (handshakeSealed) {
          rejectAndClose("HANDSHAKE_IN_PROGRESS");
          return;
        }
        handshakeSealed = true;

        const parsed = helloFrameSchema.safeParse(parseJsonObject(raw));
        if (!parsed.success) {
          rejectAndClose("INVALID_HELLO");
          return;
        }
        void authenticate(parsed.data);
        return;
      }

      // Authenticated v0.1 transport: gameplay/command frames (Gate E) are
      // rejected here and never reach the command executor.
      sendErrorFrame(socket, "UNSUPPORTED_FRAME");
    });

    socket.on("close", () => {
      const current = authenticated;
      if (!current) return;
      authenticated = null;

      const lastParticipant =
        registry.unregister(current.sessionId, current.connection.id);
      if (lastParticipant !== null) {
        void statusSerializer
          .enqueue(current.sessionId, lastParticipant, "offline")
          .catch(() => undefined);
      }
    });
  });

  return { registry, broadcaster };
}



---

# SOURCE 04: src/modules/games/realtime-registry.ts

import { randomUUID } from "node:crypto";
import type { SessionProjectionRole } from "./session-projection.js";

export interface RealtimeConnection {
  readonly id: string;
  readonly participantId: string;
  readonly role: SessionProjectionRole;
  send(payload: string): void;
}

export interface RealtimeConnectionInput {
  participantId: string;
  role: SessionProjectionRole;
  send(payload: string): void;
}

export interface RealtimeSnapshotFrame {
  type: "SNAPSHOT";
  sequence: number;
  snapshot: unknown;
}

export function snapshotFrame(sequence: number, snapshot: unknown): string {
  const frame: RealtimeSnapshotFrame = { type: "SNAPSHOT", sequence, snapshot };
  return JSON.stringify(frame);
}

export interface RoleSafeSnapshotRequest {
  sessionPublicId: string;
  participantId: string;
  role: SessionProjectionRole;
}

export interface RoleSafeSnapshotDelivery {
  sequence: number;
  snapshot: unknown;
}

export type RoleSafeSnapshotProvider = (
  request: RoleSafeSnapshotRequest,
) => Promise<RoleSafeSnapshotDelivery>;

export interface SnapshotBroadcaster {
  sendToConnection(
    sessionPublicId: string,
    connection: RealtimeConnection,
  ): Promise<void>;
  broadcastToSession(
    sessionPublicId: string,
  ): Promise<{ delivered: number; failed: number }>;
}

/**
 * Process-local transport state for authenticated realtime connections of one
 * API process. It is never the durable authority for participants, roles, or
 * session state; PostgreSQL remains authoritative (Classic v0.1 Gate D).
 */
export class SessionConnectionRegistry {
  private readonly sessions = new Map<
    string,
    Map<string, Map<string, RealtimeConnection>>
  >();

  register(sessionId: string, input: RealtimeConnectionInput): RealtimeConnection {
    const connection: RealtimeConnection = {
      id: randomUUID(),
      participantId: input.participantId,
      role: input.role,
      send: input.send,
    };

    let participants = this.sessions.get(sessionId);
    if (!participants) {
      participants = new Map();
      this.sessions.set(sessionId, participants);
    }

    let sockets = participants.get(connection.participantId);
    if (!sockets) {
      sockets = new Map();
      participants.set(connection.participantId, sockets);
    }

    sockets.set(connection.id, connection);
    return connection;
  }

  /**
   * Removes one socket. Returns the participant id when that socket was the
   * participant's last authenticated socket in the session, otherwise null.
   */
  unregister(sessionId: string, connectionId: string): string | null {
    const participants = this.sessions.get(sessionId);
    if (!participants) return null;

    for (const [participantId, sockets] of participants) {
      if (!sockets.delete(connectionId)) continue;
      if (sockets.size === 0) {
        participants.delete(participantId);
        if (participants.size === 0) this.sessions.delete(sessionId);
        return participantId;
      }
      return null;
    }

    return null;
  }

  participantSocketCount(sessionId: string, participantId: string): number {
    return this.sessions.get(sessionId)?.get(participantId)?.size ?? 0;
  }

  connectionsForSession(sessionId: string): RealtimeConnection[] {
    const participants = this.sessions.get(sessionId);
    if (!participants) return [];
    return [...participants.values()].flatMap((sockets) => [...sockets.values()]);
  }
}

export function createSnapshotBroadcaster(
  registry: SessionConnectionRegistry,
  provider: RoleSafeSnapshotProvider,
): SnapshotBroadcaster {
  async function sendToConnection(
    sessionPublicId: string,
    connection: RealtimeConnection,
  ): Promise<void> {
    const delivery = await provider({
      sessionPublicId,
      participantId: connection.participantId,
      role: connection.role,
    });
    connection.send(snapshotFrame(delivery.sequence, delivery.snapshot));
  }

  return {
    sendToConnection,
    async broadcastToSession(sessionPublicId) {
      let delivered = 0;
      let failed = 0;
      for (const connection of registry.connectionsForSession(sessionPublicId)) {
        try {
          await sendToConnection(sessionPublicId, connection);
          delivered += 1;
        } catch {
          failed += 1;
        }
      }
      return { delivered, failed };
    },
  };
}



---

# SOURCE 05: src/modules/games/session-lifecycle-service.ts lines 720-855

  }

  async getSnapshot(
    sessionPublicId: string,
    participantPublicId: string,
    resumeToken: string,
  ): Promise<LifecycleSnapshot> {
    const verified = await this.loadVerifiedProjection(
      sessionPublicId,
      participantPublicId,
      resumeToken,
    );
    return verified.snapshot;
  }

  /**
   * Gate D HELLO verification: resolves the participant credential and role in
   * PostgreSQL and returns the authoritative role-safe projection from the
   * same transaction. Role authority always comes from the database, never
   * from client input.
   */
  async verifyRealtimeCredential(
    sessionPublicId: string,
    participantPublicId: string,
    resumeToken: string,
  ): Promise<{ role: SessionProjectionRole; snapshot: SessionProjection }> {
    return this.loadVerifiedProjection(
      sessionPublicId,
      participantPublicId,
      resumeToken,
    );
  }

  /**
   * Rebuilds the current role-safe projection for an already authenticated
   * participant. Used by the realtime broadcast primitive after credential
   * verification; call only with participant ids verified in this process.
   */
  async getRoleSafeSnapshot(
    sessionPublicId: string,
    participantPublicId: string,
  ): Promise<SessionProjection> {
    const verified = await this.loadVerifiedProjection(
      sessionPublicId,
      participantPublicId,
      null,
    );
    return verified.snapshot;
  }

  async setParticipantConnectionStatus(
    sessionPublicId: string,
    participantPublicId: string,
    status: "online" | "offline",
  ): Promise<void> {
    const result = await this.pool.query(
      `UPDATE session_participants sp
          SET connection_status = $3
         FROM game_sessions gs
        WHERE gs.id = sp.session_id
          AND gs.public_id = $1
          AND sp.public_id = $2`,
      [sessionPublicId, participantPublicId, status],
    );
    if (result.rowCount === 0) {
      throw new SessionCredentialError("Invalid session credential");
    }
  }

  /**
   * Verifies the session participant credential (when a resume token is given)
   * and rebuilds the authoritative role-safe projection in one transaction.
   * A null resumeToken skips token verification for already-authenticated
   * callers; every other failure maps to the generic credential error.
   */
  private async loadVerifiedProjection(
    sessionPublicId: string,
    participantPublicId: string,
    resumeToken: string | null,
  ): Promise<{ role: SessionProjectionRole; snapshot: SessionProjection }> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const sessions = await client.query<SessionRow>(
        `SELECT id, public_id, room_code, status, phase, state_version, config
           FROM game_sessions
          WHERE public_id = $1
          FOR SHARE`,
        [sessionPublicId],
      );
      const session = sessions.rows[0];
      if (!session || session.status !== "active") {
        throw new SessionCredentialError("Invalid session credential");
      }

      const participants = await client.query<ParticipantCredentialRow>(
        `SELECT role, reconnect_token_hash, left_at
           FROM session_participants
          WHERE session_id = $1 AND public_id = $2
          FOR SHARE`,
        [session.id, participantPublicId],
      );
      const participant = participants.rows[0];
      if (
        !participant ||
        participant.left_at ||
        !participant.reconnect_token_hash ||
        (resumeToken !== null &&
          !verifyResumeToken(resumeToken, participant.reconnect_token_hash))
      ) {
        throw new SessionCredentialError("Invalid session credential");
      }

      const state = await reconstructState(client, session);
      const projectionSource = await buildProjectionSource(client, session, state);
      let snapshot: SessionProjection;
      try {
        snapshot = buildSessionProjection(
          projectionSource,
          participant.role,
          participantPublicId,
        );
      } catch (error) {
        if (error instanceof UnsupportedSessionProjectionRoleError) {
          throw new SessionCredentialError("Invalid session credential");
        }
        throw error;
      }
      await client.query("COMMIT");
      return { role: participant.role as SessionProjectionRole, snapshot };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();


---

# SOURCE 06: src/modules/games/session-projection.ts

import type { SessionPhase } from "../../domain/game/runtime.js";

export type SessionProjectionRole = "host" | "player" | "display";

export interface ProjectionTeam {
  id: string;
  name: string;
  score: number;
}

export interface ProjectionParticipantSource {
  id: string;
  displayName: string;
  role: string;
  teamId: string | null;
}

export interface SessionProjectionSource {
  sessionId: string;
  sequence: number;
  phase: SessionPhase;
  roundIndex: number;
  activeQuestionId: string | null;
  displayParticipantNames: boolean;
  scores: Record<string, number>;
  teams: ProjectionTeam[];
  participants: ProjectionParticipantSource[];
}

interface ProjectionBase {
  sessionId: string;
  sequence: number;
  phase: SessionPhase;
  roundIndex: number;
  activeQuestionId: string | null;
  teams: ProjectionTeam[];
}

export interface HostSessionProjection extends ProjectionBase {
  projection: "host";
  viewer: {
    participantId: string;
    role: "host";
  };
  scores: Record<string, number>;
  participants: Array<{
    id: string;
    displayName: string;
    role: string;
    teamId: string | null;
  }>;
}

export interface PlayerSessionProjection extends ProjectionBase {
  projection: "player";
  viewer: {
    participantId: string;
    role: "player";
  };
  scores: Record<string, number>;
  participants: Array<{
    id: string;
    displayName: string;
    teamId: string | null;
    isSelf: boolean;
  }>;
}

export interface DisplaySessionProjection extends ProjectionBase {
  projection: "display";
  participants: Array<{
    displayName: string;
    teamId: string | null;
  }>;
}

export type SessionProjection =
  | HostSessionProjection
  | PlayerSessionProjection
  | DisplaySessionProjection;

export class UnsupportedSessionProjectionRoleError extends Error {}

const SUPPORTED_ROLES = new Set<SessionProjectionRole>(["host", "player", "display"]);

function assertSupportedParticipantRoles(source: SessionProjectionSource): void {
  for (const participant of source.participants) {
    if (!SUPPORTED_ROLES.has(participant.role as SessionProjectionRole)) {
      throw new UnsupportedSessionProjectionRoleError(
        `Unsupported persisted participant role: ${participant.role}`,
      );
    }
  }
}

function baseProjection(source: SessionProjectionSource): ProjectionBase {
  return {
    sessionId: source.sessionId,
    sequence: source.sequence,
    phase: source.phase,
    roundIndex: source.roundIndex,
    activeQuestionId: source.activeQuestionId,
    teams: source.teams.map((team) => ({ ...team })),
  };
}

function hostProjection(
  source: SessionProjectionSource,
  viewerParticipantId: string,
): HostSessionProjection {
  return {
    ...baseProjection(source),
    projection: "host",
    viewer: {
      participantId: viewerParticipantId,
      role: "host",
    },
    scores: { ...source.scores },
    participants: source.participants.map((participant) => ({ ...participant })),
  };
}

function revealedQuestionId(source: SessionProjectionSource): string | null {
  return (["answering", "judging", "scoring", "turn_end"] as SessionPhase[])
    .includes(source.phase)
    ? source.activeQuestionId
    : null;
}

function playerProjection(
  source: SessionProjectionSource,
  viewerParticipantId: string,
): PlayerSessionProjection {
  return {
    ...baseProjection(source),
    activeQuestionId: revealedQuestionId(source),
    projection: "player",
    viewer: {
      participantId: viewerParticipantId,
      role: "player",
    },
    scores: { ...source.scores },
    participants: source.participants.map((participant) => ({
      id: participant.id,
      displayName: participant.displayName,
      teamId: participant.teamId,
      isSelf: participant.id === viewerParticipantId,
    })),
  };
}

function displayProjection(source: SessionProjectionSource): DisplaySessionProjection {
  return {
    ...baseProjection(source),
    activeQuestionId: revealedQuestionId(source),
    projection: "display",
    participants: source.displayParticipantNames
      ? source.participants.map((participant) => ({
          displayName: participant.displayName,
          teamId: participant.teamId,
        }))
      : [],
  };
}

export function buildSessionProjection(
  source: SessionProjectionSource,
  role: "host",
  viewerParticipantId: string,
): HostSessionProjection;
export function buildSessionProjection(
  source: SessionProjectionSource,
  role: "player",
  viewerParticipantId: string,
): PlayerSessionProjection;
export function buildSessionProjection(
  source: SessionProjectionSource,
  role: "display",
  viewerParticipantId: string,
): DisplaySessionProjection;
export function buildSessionProjection(
  source: SessionProjectionSource,
  role: string,
  viewerParticipantId: string,
): SessionProjection;
export function buildSessionProjection(
  source: SessionProjectionSource,
  role: string,
  viewerParticipantId: string,
): SessionProjection {
  assertSupportedParticipantRoles(source);

  switch (role) {
    case "host":
      return hostProjection(source, viewerParticipantId);
    case "player":
      return playerProjection(source, viewerParticipantId);
    case "display":
      return displayProjection(source);
    default:
      throw new UnsupportedSessionProjectionRoleError(
        `Unsupported session projection role: ${role}`,
      );
  }
}



---

# SOURCE 07: tests/realtime.test.ts

import Fastify, { type FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import { afterAll, describe, expect, it } from "vitest";
import {
  registerRealtimeRoutes,
  type RealtimeRouteHandle,
  type RealtimeSessionAccess,
} from "../src/api/realtime-routes.js";
import {
  createSnapshotBroadcaster,
  SessionConnectionRegistry,
  snapshotFrame,
  type RoleSafeSnapshotDelivery,
} from "../src/modules/games/realtime-registry.js";
import type {
  SessionProjection,
  SessionProjectionRole,
} from "../src/modules/games/session-projection.js";
import { RealtimeTestClient, realtimeUrl, waitFor } from "./realtime-client.js";

interface AccessCalls {
  verify: Array<{ sessionId: string; participantId: string; resumeToken: string }>;
  status: Array<{ sessionId: string; participantId: string; status: string }>;
  snapshots: Array<{ sessionId: string; participantId: string }>;
}

function roleFor(participantId: string): SessionProjectionRole {
  if (participantId === "PART_HOST") return "host";
  if (participantId === "PART_DISPLAY") return "display";
  return "player";
}

function buildSnapshot(
  role: SessionProjectionRole,
  participantId: string,
  sequence = 7,
): SessionProjection {
  const base = {
    sessionId: "SES_UNIT",
    sequence,
    phase: "lobby" as const,
    roundIndex: 0,
    activeQuestionId: null,
    teams: [],
  };
  if (role === "host") {
    return {
      ...base,
      projection: "host",
      viewer: { participantId, role: "host" },
      scores: {},
      participants: [],
    };
  }
  if (role === "player") {
    return {
      ...base,
      projection: "player",
      viewer: { participantId, role: "player" },
      scores: {},
      participants: [],
    };
  }
  return { ...base, projection: "display", participants: [] };
}

function createFakeAccess(
  overrides: Partial<RealtimeSessionAccess> = {},
): { access: RealtimeSessionAccess; calls: AccessCalls } {
  const calls: AccessCalls = { verify: [], status: [], snapshots: [] };
  const access: RealtimeSessionAccess = {
    async verifyRealtimeCredential(sessionId, participantId, resumeToken) {
      calls.verify.push({ sessionId, participantId, resumeToken });
      if (resumeToken !== "token-ok") {
        throw new Error("Invalid session credential");
      }
      const role = roleFor(participantId);
      return { role, snapshot: buildSnapshot(role, participantId) };
    },
    async getRoleSafeSnapshot(sessionId, participantId) {
      calls.snapshots.push({ sessionId, participantId });
      return buildSnapshot(roleFor(participantId), participantId, 8);
    },
    async setParticipantConnectionStatus(sessionId, participantId, status) {
      calls.status.push({ sessionId, participantId, status });
    },
    ...overrides,
  };
  return { access, calls };
}

const openApps: FastifyInstance[] = [];

async function buildRealtimeApp(
  access: RealtimeSessionAccess,
): Promise<{ handle: RealtimeRouteHandle; url: string }> {
  const instance = Fastify({ logger: false });
  await instance.register(websocket);
  const handle = await registerRealtimeRoutes(instance, access);
  await instance.ready();
  await instance.listen({ host: "127.0.0.1", port: 0 });
  openApps.push(instance);
  return { handle, url: realtimeUrl(instance) };
}

afterAll(async () => {
  for (const instance of openApps) await instance.close();
});

describe("Realtime HELLO handshake (unit)", () => {
  it("rejects malformed HELLO frames without touching credential verification", async () => {
    const { access, calls } = createFakeAccess();
    const { url } = await buildRealtimeApp(access);

    const malformed = [
      "not-json",
      "",
      "42",
      "[1,2,3]",
      JSON.stringify({ type: "HELLO" }),
      JSON.stringify({ type: "HELLO", sessionId: "SES_UNIT", participantId: "PART_1" }),
      JSON.stringify({
        type: "HELLO",
        sessionId: "",
        participantId: "PART_1",
        resumeToken: "token-ok",
      }),
      JSON.stringify({
        type: "HELLO",
        sessionId: "SES_UNIT",
        participantId: "PART_1",
        resumeToken: "token-ok",
        lastSequence: "3",
      }),
      JSON.stringify({
        type: "HELLO",
        sessionId: "SES_UNIT",
        participantId: "PART_1",
        resumeToken: "token-ok",
        extra: true,
      }),
    ];

    for (const payload of malformed) {
      const client = await RealtimeTestClient.connect(url);
      client.sendRaw(payload);
      const frame = await client.nextFrame();
      expect(frame).toMatchObject({ type: "ERROR", code: "INVALID_HELLO" });
      const closed = await client.expectClose();
      expect(closed.code).toBe(1008);
    }

    expect(calls.verify).toHaveLength(0);
    expect(calls.status).toHaveLength(0);
  });

  it("rejects pre-auth non-HELLO messages", async () => {
    const { access, calls } = createFakeAccess();
    const { url } = await buildRealtimeApp(access);

    const client = await RealtimeTestClient.connect(url);
    client.sendJson({ type: "SNAPSHOT" });
    const frame = await client.nextFrame();
    expect(frame).toMatchObject({ type: "ERROR", code: "INVALID_HELLO" });
    await client.expectClose();
    expect(calls.verify).toHaveLength(0);
    expect(calls.status).toHaveLength(0);
  });

  it("answers ping with pong before authentication", async () => {
    const { access } = createFakeAccess();
    const { url } = await buildRealtimeApp(access);

    const client = await RealtimeTestClient.connect(url);
    client.sendRaw("ping");
    expect(await client.nextFrame()).toEqual({ raw: "pong" });
    client.socket.close();
  });

  it("answers ping with pong after authentication", async () => {
    const { access } = createFakeAccess();
    const { url } = await buildRealtimeApp(access);

    const client = await RealtimeTestClient.connect(url);
    client.hello({
      sessionId: "SES_UNIT",
      participantId: "PART_PLAYER",
      resumeToken: "token-ok",
    });
    expect(await client.nextFrame()).toMatchObject({ type: "SNAPSHOT" });
    client.sendRaw("ping");
    expect(await client.nextFrame()).toEqual({ raw: "pong" });
    client.socket.close();
  });

  it("never delivers a projection when the resume token is wrong or revoked", async () => {
    const { access, calls } = createFakeAccess();
    const { url } = await buildRealtimeApp(access);

    const client = await RealtimeTestClient.connect(url);
    client.hello({
      sessionId: "SES_UNIT",
      participantId: "PART_PLAYER",
      resumeToken: "token-revoked",
    });
    const frames = await client.framesUntilClose();
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({
      type: "ERROR",
      code: "INVALID_SESSION_CREDENTIAL",
    });
    const closed = await client.expectClose();
    expect(closed.code).toBe(1008);
    expect(calls.verify).toEqual([
      {
        sessionId: "SES_UNIT",
        participantId: "PART_PLAYER",
        resumeToken: "token-revoked",
      },
    ]);
    expect(calls.status).toHaveLength(0);
  });

  it.each(["host", "player", "display"] as const)(
    "delivers a role-safe SNAPSHOT for an authenticated %s HELLO",
    async (role) => {
      const { access, calls } = createFakeAccess();
      const { handle, url } = await buildRealtimeApp(access);

      const participantId = `PART_${role.toUpperCase()}`;
      const client = await RealtimeTestClient.connect(url);
      client.hello({
        sessionId: "SES_UNIT",
        participantId,
        resumeToken: "token-ok",
      });

      const frame = await client.nextFrame();
      expect(frame).toMatchObject({
        type: "SNAPSHOT",
        sequence: 7,
        snapshot: { projection: role },
      });
      await waitFor(() => calls.status.length === 1);
      expect(calls.status).toEqual([
        { sessionId: "SES_UNIT", participantId, status: "online" },
      ]);
      expect(handle.registry.participantSocketCount("SES_UNIT", participantId)).toBe(1);

      client.socket.close();
      await waitFor(
        () => handle.registry.participantSocketCount("SES_UNIT", participantId) === 0,
      );
    },
  );

  it("rejects unsupported post-auth frames without any state effect", async () => {
    const { access, calls } = createFakeAccess();
    const { handle, url } = await buildRealtimeApp(access);

    const client = await RealtimeTestClient.connect(url);
    client.hello({
      sessionId: "SES_UNIT",
      participantId: "PART_PLAYER",
      resumeToken: "token-ok",
    });
    expect(await client.nextFrame()).toMatchObject({ type: "SNAPSHOT" });

    client.sendJson({ type: "SUBMIT_ANSWER", answer: "x" });
    expect(await client.nextFrame()).toMatchObject({
      type: "ERROR",
      code: "UNSUPPORTED_FRAME",
    });

    // The socket stays usable as transport and no state-changing call happened.
    client.sendRaw("ping");
    expect(await client.nextFrame()).toEqual({ raw: "pong" });
    client.sendJson({ type: "START_GAME" });
    expect(await client.nextFrame()).toMatchObject({ code: "UNSUPPORTED_FRAME" });
    expect(calls.snapshots).toHaveLength(0);
    expect(calls.status).toEqual([
      { sessionId: "SES_UNIT", participantId: "PART_PLAYER", status: "online" },
    ]);
    expect(handle.registry.connectionsForSession("SES_UNIT")).toHaveLength(1);

    client.socket.close();
  });

  it("rejects frames sent while a HELLO handshake is in flight and never registers", async () => {
    let releaseVerify: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      releaseVerify = resolve;
    });
    const { access, calls } = createFakeAccess({
      async verifyRealtimeCredential(sessionId, participantId) {
        await gate;
        return { role: "player", snapshot: buildSnapshot("player", participantId) };
      },
    });
    const { handle, url } = await buildRealtimeApp(access);

    const client = await RealtimeTestClient.connect(url);
    client.hello({
      sessionId: "SES_UNIT",
      participantId: "PART_PLAYER",
      resumeToken: "token-ok",
    });
    client.hello({
      sessionId: "SES_UNIT",
      participantId: "PART_PLAYER",
      resumeToken: "token-ok",
    });

    const frames = await client.framesUntilClose();
    expect(frames.at(-1)).toMatchObject({ code: "HANDSHAKE_IN_PROGRESS" });

    releaseVerify();
    await waitFor(() => handle.registry.connectionsForSession("SES_UNIT").length === 0);
    expect(calls.status).toHaveLength(0);
  });

  it("keeps a participant online while other authenticated sockets remain", async () => {
    const { access, calls } = createFakeAccess();
    const { handle, url } = await buildRealtimeApp(access);

    const first = await RealtimeTestClient.connect(url);
    const second = await RealtimeTestClient.connect(url);
    for (const client of [first, second]) {
      client.hello({
        sessionId: "SES_UNIT",
        participantId: "PART_PLAYER",
        resumeToken: "token-ok",
      });
    }
    expect(await first.nextFrame()).toMatchObject({ type: "SNAPSHOT" });
    expect(await second.nextFrame()).toMatchObject({ type: "SNAPSHOT" });
    await waitFor(() => calls.status.length === 2);

    first.socket.close();
    await waitFor(() => handle.registry.participantSocketCount("SES_UNIT", "PART_PLAYER") === 1);
    expect(calls.status.every((entry) => entry.status === "online")).toBe(true);

    second.socket.close();
    await waitFor(() => calls.status.some((entry) => entry.status === "offline"));
    expect(calls.status.filter((entry) => entry.status === "offline")).toEqual([
      { sessionId: "SES_UNIT", participantId: "PART_PLAYER", status: "offline" },
    ]);
  });

  it("marks a participant offline after the final authenticated socket closes", async () => {
    const { access, calls } = createFakeAccess();
    const { handle, url } = await buildRealtimeApp(access);

    const client = await RealtimeTestClient.connect(url);
    client.hello({
      sessionId: "SES_UNIT",
      participantId: "PART_PLAYER",
      resumeToken: "token-ok",
    });
    expect(await client.nextFrame()).toMatchObject({ type: "SNAPSHOT" });

    client.socket.close();
    await waitFor(
      () =>
        calls.status.at(-1)?.status === "offline" &&
        handle.registry.connectionsForSession("SES_UNIT").length === 0,
    );
    expect(calls.status).toEqual([
      { sessionId: "SES_UNIT", participantId: "PART_PLAYER", status: "online" },
      { sessionId: "SES_UNIT", participantId: "PART_PLAYER", status: "offline" },
    ]);
  });

  it("delivers per-viewer snapshots through the broadcast primitive", async () => {
    const { access, calls } = createFakeAccess();
    const { handle, url } = await buildRealtimeApp(access);

    const host = await RealtimeTestClient.connect(url);
    const player = await RealtimeTestClient.connect(url);
    host.hello({ sessionId: "SES_UNIT", participantId: "PART_HOST", resumeToken: "token-ok" });
    player.hello({ sessionId: "SES_UNIT", participantId: "PART_PLAYER", resumeToken: "token-ok" });
    expect(await host.nextFrame()).toMatchObject({ type: "SNAPSHOT", sequence: 7 });
    expect(await player.nextFrame()).toMatchObject({ type: "SNAPSHOT", sequence: 7 });

    const result = await handle.broadcaster.broadcastToSession("SES_UNIT");
    expect(result).toEqual({ delivered: 2, failed: 0 });

    const hostFrame = await host.nextFrame();
    const playerFrame = await player.nextFrame();
    expect(hostFrame).toMatchObject({
      type: "SNAPSHOT",
      sequence: 8,
      snapshot: { viewer: { participantId: "PART_HOST", role: "host" } },
    });
    expect(playerFrame).toMatchObject({
      type: "SNAPSHOT",
      sequence: 8,
      snapshot: { viewer: { participantId: "PART_PLAYER", role: "player" } },
    });
    expect(calls.snapshots.map((entry) => entry.participantId)).toEqual([
      "PART_HOST",
      "PART_PLAYER",
    ]);

    host.socket.close();
    player.socket.close();
  });
});

describe("SessionConnectionRegistry (unit)", () => {
  it("tracks sockets per participant and reports the last socket", () => {
    const registry = new SessionConnectionRegistry();
    const first = registry.register("SES", {
      participantId: "P1",
      role: "player",
      send: () => undefined,
    });
    const second = registry.register("SES", {
      participantId: "P1",
      role: "player",
      send: () => undefined,
    });
    const host = registry.register("SES", {
      participantId: "P2",
      role: "host",
      send: () => undefined,
    });

    expect(registry.participantSocketCount("SES", "P1")).toBe(2);
    expect(registry.connectionsForSession("SES")).toHaveLength(3);
    expect(registry.connectionsForSession("UNKNOWN")).toEqual([]);

    expect(registry.unregister("SES", first.id)).toBeNull();
    expect(registry.unregister("SES", first.id)).toBeNull();
    expect(registry.participantSocketCount("SES", "P1")).toBe(1);
    expect(registry.unregister("SES", second.id)).toBe("P1");
    expect(registry.unregister("OTHER", host.id)).toBeNull();
    expect(registry.unregister("SES", host.id)).toBe("P2");
    expect(registry.connectionsForSession("SES")).toEqual([]);
  });
});

describe("snapshotFrame (unit)", () => {
  it("builds the contract SNAPSHOT frame shape", () => {
    expect(JSON.parse(snapshotFrame(42, { any: "payload" }))).toEqual({
      type: "SNAPSHOT",
      sequence: 42,
      snapshot: { any: "payload" },
    });
  });
});



---

# SOURCE 08: tests/realtime.integration.test.ts

import Fastify, { type FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createRealtimeSessionAccess,
  registerRealtimeRoutes,
} from "../src/api/realtime-routes.js";
import {
  hashResumeToken,
  SessionLifecycleService,
  type LifecycleCredentialResponse,
} from "../src/modules/games/session-lifecycle-service.js";
import { RealtimeTestClient, realtimeUrl, type RealtimeFrame } from "./realtime-client.js";

const { Pool } = pg;
const databaseUrl = process.env.ARENA_TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const resumeTokenKey = "62".repeat(32);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describeDatabase("Classic Gate D realtime integration", () => {
  let pool: InstanceType<typeof Pool>;
  let app: FastifyInstance;
  let url: string;
  let lifecycle: SessionLifecycleService;
  const sessionIds = new Set<string>();
  const modeIds = new Set<string>();
  const idempotencyKeys = new Set<string>();

  async function createMode(): Promise<string> {
    const suffix = randomUUID();
    const modePublicId = `TEST_RT_MODE_${suffix}`;
    const versionPublicId = `TEST_RT_MODEV_${suffix}`;
    modeIds.add(modePublicId);

    const mode = await pool.query<{ id: string }>(
      `INSERT INTO game_modes(public_id,key,status)
       VALUES ($1,$2,'active')
       RETURNING id`,
      [modePublicId, `realtime-${suffix}`],
    );
    await pool.query(
      `INSERT INTO game_mode_versions
         (public_id,game_mode_id,version,state_machine_key,status,published_at)
       VALUES ($1,$2,1,'classic-v0.1','published',now())`,
      [versionPublicId, mode.rows[0]!.id],
    );
    return versionPublicId;
  }

  async function createHost(): Promise<LifecycleCredentialResponse> {
    const version = await createMode();
    const key = `realtime-create-${randomUUID()}`;
    idempotencyKeys.add(key);
    const response = await lifecycle.createSession(
      {
        gameModeVersionId: version,
        gameTemplateId: null,
        locale: "ar-SA",
        displayName: "Host",
      },
      key,
    );
    sessionIds.add(response.session.id);
    return response;
  }

  async function joinPlayer(
    roomCode: string,
  ): Promise<LifecycleCredentialResponse> {
    const key = `realtime-join-${randomUUID()}`;
    idempotencyKeys.add(key);
    return lifecycle.joinSession({ roomCode, displayName: "Player One" }, key);
  }

  async function insertDisplay(
    sessionPublicId: string,
  ): Promise<{ participantId: string; resumeToken: string }> {
    const internal = await pool.query<{ id: string }>(
      "SELECT id FROM game_sessions WHERE public_id=$1",
      [sessionPublicId],
    );
    const participantId = `PART_DISPLAY_${randomUUID()}`;
    const resumeToken = `${randomUUID()}${randomUUID()}`;
    await pool.query(
      `INSERT INTO session_participants
         (public_id,session_id,role,display_name_snapshot,connection_status,reconnect_token_hash)
       VALUES ($1,$2,'display','Main Screen','offline',$3)`,
      [participantId, internal.rows[0]!.id, hashResumeToken(resumeToken)],
    );
    return { participantId, resumeToken };
  }

  async function participantStatus(
    sessionPublicId: string,
    participantId: string,
  ): Promise<string | undefined> {
    const result = await pool.query<{ connection_status: string }>(
      `SELECT sp.connection_status
         FROM session_participants sp
         JOIN game_sessions gs ON gs.id = sp.session_id
        WHERE gs.public_id = $1 AND sp.public_id = $2`,
      [sessionPublicId, participantId],
    );
    return result.rows[0]?.connection_status;
  }

  async function waitForStatus(
    sessionPublicId: string,
    participantId: string,
    expected: string,
    timeoutMs = 3000,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const status = await participantStatus(sessionPublicId, participantId);
      if (status === expected) return;
      if (Date.now() > deadline) {
        throw new Error(
          `Participant ${participantId} status never became "${expected}" (last: ${status})`,
        );
      }
      await sleep(25);
    }
  }

  async function hello(
    credentials: {
      sessionId: string;
      participantId: string;
      resumeToken: string;
    },
  ): Promise<{ client: RealtimeTestClient; frame: RealtimeFrame }> {
    const client = await RealtimeTestClient.connect(url);
    client.hello(credentials);
    const frame = await client.nextFrame();
    expect(frame).toMatchObject({ type: "SNAPSHOT" });
    if (!frame) throw new Error("Expected a SNAPSHOT response frame");
    return { client, frame };
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 8 });
    await pool.query(
      `INSERT INTO locales(code,name,native_name,direction,is_enabled)
       VALUES ('ar-SA','Arabic (Saudi Arabia)','العربية (السعودية)','rtl',true)
       ON CONFLICT (code) DO NOTHING`,
    );
    lifecycle = new SessionLifecycleService(pool, resumeTokenKey);
    app = Fastify({ logger: false });
    await app.register(websocket);
    await registerRealtimeRoutes(
      app,
      createRealtimeSessionAccess(pool, resumeTokenKey),
    );
    await app.ready();
    await app.listen({ host: "127.0.0.1", port: 0 });
    url = realtimeUrl(app);
  });

  afterEach(async () => {
    if (idempotencyKeys.size) {
      await pool.query(
        "DELETE FROM idempotency_records WHERE idempotency_key = ANY($1::text[])",
        [[...idempotencyKeys]],
      );
      idempotencyKeys.clear();
    }
    if (sessionIds.size) {
      await pool.query(
        "DELETE FROM game_sessions WHERE public_id = ANY($1::text[])",
        [[...sessionIds]],
      );
      sessionIds.clear();
    }
    if (modeIds.size) {
      await pool.query(
        "DELETE FROM game_modes WHERE public_id = ANY($1::text[])",
        [[...modeIds]],
      );
      modeIds.clear();
    }
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it("authenticates Host, Player, and Display HELLOs and delivers role-safe snapshots", async () => {
    const host = await createHost();
    const player = await joinPlayer(host.session.roomCode);
    const display = await insertDisplay(host.session.id);

    const hostSession = await hello({
      sessionId: host.session.id,
      participantId: host.participant.id,
      resumeToken: host.resumeToken,
    });
    const playerSession = await hello({
      sessionId: host.session.id,
      participantId: player.participant.id,
      resumeToken: player.resumeToken,
    });
    const displaySession = await hello({
      sessionId: host.session.id,
      participantId: display.participantId,
      resumeToken: display.resumeToken,
    });

    const hostSnapshot = hostSession.frame.snapshot as Record<string, unknown>;
    expect(hostSnapshot.projection).toBe("host");
    expect(hostSnapshot.viewer).toEqual({
      participantId: host.participant.id,
      role: "host",
    });
    expect(hostSnapshot.phase).toBe("lobby");

    const playerSnapshot = playerSession.frame.snapshot as Record<string, unknown>;
    expect(playerSnapshot.projection).toBe("player");
    expect(playerSnapshot.viewer).toEqual({
      participantId: player.participant.id,
      role: "player",
    });
    expect(JSON.stringify(playerSnapshot.participants)).not.toContain('"role"');

    const displaySnapshot = displaySession.frame.snapshot as Record<string, unknown>;
    expect(displaySnapshot.projection).toBe("display");
    expect("viewer" in displaySnapshot).toBe(false);
    expect("scores" in displaySnapshot).toBe(false);
    expect(JSON.stringify(displaySession.frame)).not.toContain(host.participant.id);
    expect(JSON.stringify(displaySession.frame)).not.toContain(player.participant.id);
    expect(JSON.stringify(displaySession.frame)).not.toContain(display.participantId);

    for (const frame of [hostSession.frame, playerSession.frame, displaySession.frame]) {
      expect(JSON.stringify(frame)).not.toContain(host.resumeToken);
      expect(JSON.stringify(frame)).not.toContain(player.resumeToken);
      expect(JSON.stringify(frame)).not.toContain(display.resumeToken);
    }

    await waitForStatus(host.session.id, host.participant.id, "online");
    await waitForStatus(host.session.id, player.participant.id, "online");
    await waitForStatus(host.session.id, display.participantId, "online");

    hostSession.client.socket.close();
    playerSession.client.socket.close();
    displaySession.client.socket.close();
  });

  it("never delivers a projection for a wrong or revoked token", async () => {
    const host = await createHost();

    const client = await RealtimeTestClient.connect(url);
    client.hello({
      sessionId: host.session.id,
      participantId: host.participant.id,
      resumeToken: "wrong-or-revoked-token",
    });

    const frames = await client.framesUntilClose();
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({
      type: "ERROR",
      code: "INVALID_SESSION_CREDENTIAL",
    });
    expect(await client.expectClose()).toMatchObject({ code: 1008 });
    expect(JSON.stringify(frames)).not.toContain("snapshot");

    expect(await participantStatus(host.session.id, host.participant.id)).toBe("offline");
  });

  it("keeps a participant online across duplicate sockets until the final disconnect", async () => {
    const host = await createHost();
    const player = await joinPlayer(host.session.roomCode);
    const credentials = {
      sessionId: host.session.id,
      participantId: player.participant.id,
      resumeToken: player.resumeToken,
    };

    const first = await hello(credentials);
    const second = await hello(credentials);
    await waitForStatus(host.session.id, player.participant.id, "online");

    first.client.socket.close();
    const offlineDeadline = Date.now() + 300;
    let becameOffline = false;
    while (Date.now() < offlineDeadline) {
      if ((await participantStatus(host.session.id, player.participant.id)) === "offline") {
        becameOffline = true;
        break;
      }
      await sleep(25);
    }
    expect(becameOffline).toBe(false);
    expect(await participantStatus(host.session.id, player.participant.id)).toBe("online");

    second.client.socket.close();
    await waitForStatus(host.session.id, player.participant.id, "offline");
  });

  it("rejects post-auth gameplay frames without any state mutation", async () => {
    const host = await createHost();
    const session = await hello({
      sessionId: host.session.id,
      participantId: host.participant.id,
      resumeToken: host.resumeToken,
    });

    const before = await pool.query<{ state_version: string | number; snapshots: string }>(
      `SELECT gs.state_version,
              (SELECT count(*) FROM session_snapshots ss WHERE ss.session_id = gs.id)::text AS snapshots
         FROM game_sessions gs
        WHERE gs.public_id = $1`,
      [host.session.id],
    );

    session.client.sendJson({ type: "START_GAME" });
    expect(await session.client.nextFrame()).toMatchObject({
      type: "ERROR",
      code: "UNSUPPORTED_FRAME",
    });

    session.client.sendRaw("ping");
    expect(await session.client.nextFrame()).toEqual({ raw: "pong" });

    const after = await pool.query<{ state_version: string | number; snapshots: string }>(
      `SELECT gs.state_version,
              (SELECT count(*) FROM session_snapshots ss WHERE ss.session_id = gs.id)::text AS snapshots
         FROM game_sessions gs
        WHERE gs.public_id = $1`,
      [host.session.id],
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
    expect(await participantStatus(host.session.id, host.participant.id)).toBe("online");

    session.client.socket.close();
  });

  it("returns a fresh authoritative snapshot on reconnect and restores online status", async () => {
    const host = await createHost();
    const credentials = {
      sessionId: host.session.id,
      participantId: host.participant.id,
      resumeToken: host.resumeToken,
    };

    const first = await hello(credentials);
    expect((first.frame.sequence as number) ?? 0).toBe(0);
    first.client.socket.close();
    await waitForStatus(host.session.id, host.participant.id, "offline");

    const second = await hello(credentials);
    expect(second.frame.type).toBe("SNAPSHOT");
    expect(second.frame.snapshot).toMatchObject({
      projection: "host",
      sessionId: host.session.id,
      phase: "lobby",
    });
    await waitForStatus(host.session.id, host.participant.id, "online");

    second.client.socket.close();
  });
});

