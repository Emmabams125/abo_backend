/**
 * Hand-authored OpenAPI 3.0 spec, served via Swagger UI at /docs, for
 * interactive testing (see swaggerUi.setup wiring in app.ts). Kept as one
 * TS object — rather than JSDoc-per-route comments — so shared pieces
 * (auth schemes, the error envelope, uuid path params) are defined once via
 * the helpers below instead of repeated 50 times across every endpoint.
 *
 * Request bodies/params/query are precise (they drive Swagger UI's "Try it
 * out"); response bodies are intentionally loose ("returns the created X")
 * rather than exhaustively matching every Prisma field, since this exists
 * for manual testing, not as a formal external API contract.
 */

type JsonSchema = Record<string, unknown>;

// ── Shared helpers ──────────────────────────────────────────────

function uuidParam(name: string, description: string) {
  return {
    name,
    in: "path",
    required: true,
    schema: { type: "string", format: "uuid" },
    description,
  };
}

const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: "Validation error or malformed request",
  401: "Missing, invalid, or expired access token",
  403: "Forbidden — not a member, wrong role, or reauth required",
  404: "Not found",
  409: "Conflict",
  429: "Too many requests",
};

function errorResponses(...statuses: number[]) {
  const responses: Record<string, JsonSchema> = {};
  for (const status of statuses) {
    responses[String(status)] = {
      description: ERROR_DESCRIPTIONS[status] ?? "Error",
      content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
    };
  }
  return responses;
}

const bearer = { bearerAuth: [] as string[] };
const bearerAndReauth = { bearerAuth: [] as string[], reauthToken: [] as string[] };

const phoneSchema: JsonSchema = {
  type: "string",
  pattern: "^\\+[1-9]\\d{7,14}$",
  example: "+2348012345678",
  description: "E.164 format",
};

const alertKindSchema: JsonSchema = { type: "string", enum: ["MISSING", "LOST_ITEM", "HAZARD"] };

function jsonBody(schema: JsonSchema, required = true) {
  return { required, content: { "application/json": { schema } } };
}

function okResponse(description: string, schema: JsonSchema = { type: "object" }) {
  return { description, content: { "application/json": { schema } } };
}

// ── Spec ─────────────────────────────────────────────────────────

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Abo Backend API",
    version: "0.1.0",
    description:
      "Family safety platform API. Auth flow: POST /auth/otp/request → POST /auth/otp/verify to get an accessToken, then click 'Authorize' above and paste it in as a Bearer token to try authenticated endpoints.",
  },
  servers: [{ url: "/", description: "Current host" }],
  security: [bearer],
  tags: [
    { name: "Auth" },
    { name: "Circles" },
    { name: "Community" },
    { name: "Devices" },
    { name: "Home" },
    { name: "Location" },
    { name: "Messages" },
    { name: "Privacy Center" },
    { name: "Reassurance" },
    { name: "SOS" },
    { name: "Subscription" },
    { name: "Users" },
    { name: "Health" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      reauthToken: {
        type: "apiKey",
        in: "header",
        name: "X-Reauth-Token",
        description: "Short-lived token from POST /auth/reauth/verify, required for sensitive actions.",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string", example: "VALIDATION_ERROR" },
              message: { type: "string" },
              details: { type: "object", nullable: true },
            },
            required: ["code", "message"],
          },
        },
        required: ["error"],
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Liveness check",
        security: [],
        responses: { "200": okResponse("OK", { type: "object", properties: { status: { type: "string" } } }) },
      },
    },

    // ── Auth ─────────────────────────────────────────────────
    "/auth/otp/request": {
      post: {
        tags: ["Auth"],
        summary: "Request an OTP SMS to log in",
        security: [],
        requestBody: jsonBody({ type: "object", required: ["phone"], properties: { phone: phoneSchema } }),
        responses: {
          "202": okResponse("OTP sent", { type: "object", properties: { message: { type: "string" } } }),
          ...errorResponses(400, 429),
        },
      },
    },
    "/auth/otp/verify": {
      post: {
        tags: ["Auth"],
        summary: "Verify OTP and authenticate (creates the user on first login)",
        security: [],
        requestBody: jsonBody({
          type: "object",
          required: ["phone", "code"],
          properties: {
            phone: phoneSchema,
            code: { type: "string", minLength: 6, maxLength: 6 },
            deviceId: { type: "string", format: "uuid" },
          },
        }),
        responses: {
          "200": okResponse("Session created", {
            type: "object",
            properties: {
              accessToken: { type: "string" },
              refreshToken: { type: "string" },
              userId: { type: "string", format: "uuid" },
            },
          }),
          ...errorResponses(400, 403),
        },
      },
    },
    "/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Exchange a refresh token for a new access/refresh token pair",
        security: [],
        requestBody: jsonBody({
          type: "object",
          required: ["refreshToken"],
          properties: { refreshToken: { type: "string" } },
        }),
        responses: {
          "200": okResponse("New session", {
            type: "object",
            properties: { accessToken: { type: "string" }, refreshToken: { type: "string" } },
          }),
          ...errorResponses(401),
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Revoke a refresh token",
        security: [],
        requestBody: jsonBody({
          type: "object",
          required: ["refreshToken"],
          properties: { refreshToken: { type: "string" } },
        }),
        responses: { "204": { description: "Logged out" }, ...errorResponses(400) },
      },
    },
    "/auth/reauth/request": {
      post: {
        tags: ["Auth"],
        summary: "Request a step-up OTP for a sensitive action",
        security: [bearer],
        requestBody: jsonBody({ type: "object", required: ["phone"], properties: { phone: phoneSchema } }),
        responses: {
          "202": okResponse("OTP sent", { type: "object", properties: { message: { type: "string" } } }),
          ...errorResponses(400, 401, 429),
        },
      },
    },
    "/auth/reauth/verify": {
      post: {
        tags: ["Auth"],
        summary: "Verify step-up OTP, returns a short-lived reauth token",
        security: [bearer],
        requestBody: jsonBody({
          type: "object",
          required: ["phone", "code"],
          properties: { phone: phoneSchema, code: { type: "string", minLength: 6, maxLength: 6 } },
        }),
        responses: {
          "200": okResponse("Reauth token issued", {
            type: "object",
            properties: { reauthToken: { type: "string" } },
          }),
          ...errorResponses(400, 401),
        },
      },
    },

    // ── Circles ──────────────────────────────────────────────
    "/circles": {
      post: {
        tags: ["Circles"],
        summary: "Create a circle (caller becomes admin)",
        requestBody: jsonBody({
          type: "object",
          required: ["name"],
          properties: { name: { type: "string", minLength: 1, maxLength: 80 } },
        }),
        responses: { "201": okResponse("Created circle"), ...errorResponses(400, 401) },
      },
    },
    "/circles/{circleId}/members": {
      get: {
        tags: ["Circles"],
        summary: "List circle members",
        parameters: [uuidParam("circleId", "Circle ID")],
        responses: {
          "200": okResponse("Members", { type: "array", items: { type: "object" } }),
          ...errorResponses(401, 403, 404),
        },
      },
    },
    "/circles/{circleId}/invites": {
      post: {
        tags: ["Circles"],
        summary: "Create an invite code for the circle",
        parameters: [uuidParam("circleId", "Circle ID")],
        responses: { "201": okResponse("Created invite"), ...errorResponses(401, 403, 404) },
      },
    },
    "/circles/invites/accept": {
      post: {
        tags: ["Circles"],
        summary: "Accept an invite by code (may land as pending approval)",
        requestBody: jsonBody({
          type: "object",
          required: ["code"],
          properties: { code: { type: "string", minLength: 1 } },
        }),
        responses: { "200": okResponse("Membership result"), ...errorResponses(400, 401, 404, 409) },
      },
    },
    "/circles/{circleId}/memberships/{membershipId}/approve": {
      post: {
        tags: ["Circles"],
        summary: "Approve a pending membership (admin only)",
        parameters: [uuidParam("circleId", "Circle ID"), uuidParam("membershipId", "Membership ID")],
        responses: { "200": okResponse("Updated membership"), ...errorResponses(400, 401, 403, 404) },
      },
    },
    "/circles/{circleId}/memberships/{membershipId}/role": {
      patch: {
        tags: ["Circles"],
        summary: "Change a member's role (admin only, requires reauth)",
        security: [bearerAndReauth],
        parameters: [uuidParam("circleId", "Circle ID"), uuidParam("membershipId", "Membership ID")],
        requestBody: jsonBody({
          type: "object",
          required: ["role"],
          properties: { role: { type: "string", enum: ["ADMIN", "ADULT", "MANAGED"] } },
        }),
        responses: { "200": okResponse("Updated membership"), ...errorResponses(400, 401, 403, 404) },
      },
    },
    "/circles/{circleId}/memberships/{membershipId}": {
      delete: {
        tags: ["Circles"],
        summary: "Remove a member (admin only, requires reauth)",
        security: [bearerAndReauth],
        parameters: [uuidParam("circleId", "Circle ID"), uuidParam("membershipId", "Membership ID")],
        responses: { "200": okResponse("Removed membership"), ...errorResponses(401, 403, 404) },
      },
    },
    "/circles/{circleId}/memberships/{membershipId}/acknowledge-notice": {
      post: {
        tags: ["Circles"],
        summary: "Managed member acknowledges the transparency notice",
        parameters: [uuidParam("circleId", "Circle ID"), uuidParam("membershipId", "Membership ID")],
        responses: { "200": okResponse("Updated membership"), ...errorResponses(401, 403, 404) },
      },
    },
    "/circles/{circleId}/audit-logs": {
      get: {
        tags: ["Circles"],
        summary: "List admin-action audit logs (admin only)",
        parameters: [uuidParam("circleId", "Circle ID")],
        responses: {
          "200": okResponse("Audit logs", { type: "array", items: { type: "object" } }),
          ...errorResponses(401, 403, 404),
        },
      },
    },

    // ── Community ────────────────────────────────────────────
    "/community": {
      post: {
        tags: ["Community"],
        summary: "Post a community safety alert at a location",
        requestBody: jsonBody({
          type: "object",
          required: ["kind", "title", "placeLabel", "lat", "lng"],
          properties: {
            kind: alertKindSchema,
            title: { type: "string", minLength: 1, maxLength: 120 },
            description: { type: "string", maxLength: 500 },
            placeLabel: { type: "string", minLength: 1, maxLength: 80 },
            lat: { type: "number", minimum: -90, maximum: 90 },
            lng: { type: "number", minimum: -180, maximum: 180 },
          },
        }),
        responses: { "201": okResponse("Created alert"), ...errorResponses(400, 401, 429) },
      },
    },
    "/community/nearby": {
      get: {
        tags: ["Community"],
        summary: "List unresolved alerts near a point",
        parameters: [
          { name: "lat", in: "query", required: true, schema: { type: "number", minimum: -90, maximum: 90 } },
          { name: "lng", in: "query", required: true, schema: { type: "number", minimum: -180, maximum: 180 } },
          {
            name: "radiusM",
            in: "query",
            schema: { type: "integer", minimum: 500, maximum: 20000, default: 5000 },
          },
          { name: "kind", in: "query", schema: alertKindSchema },
        ],
        responses: {
          "200": okResponse("Nearby alerts", { type: "array", items: { type: "object" } }),
          ...errorResponses(400, 401),
        },
      },
    },
    "/community/{alertId}/resolve": {
      patch: {
        tags: ["Community"],
        summary: "Mark a community alert resolved (author only)",
        parameters: [uuidParam("alertId", "Alert ID")],
        responses: { "200": okResponse("Updated alert"), ...errorResponses(401, 403, 404) },
      },
    },

    // ── Devices ──────────────────────────────────────────────
    "/devices": {
      get: {
        tags: ["Devices"],
        summary: "List caller's registered push devices",
        responses: {
          "200": okResponse("Devices", { type: "array", items: { type: "object" } }),
          ...errorResponses(401),
        },
      },
      post: {
        tags: ["Devices"],
        summary: "Register/update a device for push notifications",
        requestBody: jsonBody({
          type: "object",
          required: ["platform"],
          properties: {
            deviceId: { type: "string", format: "uuid" },
            platform: { type: "string", enum: ["IOS", "ANDROID"] },
            pushToken: { type: "string", minLength: 1 },
          },
        }),
        responses: { "201": okResponse("Registered device"), ...errorResponses(400, 401) },
      },
    },
    "/devices/{deviceId}": {
      delete: {
        tags: ["Devices"],
        summary: "Unpair a device",
        parameters: [uuidParam("deviceId", "Device ID")],
        responses: { "204": { description: "Removed" }, ...errorResponses(401, 404) },
      },
    },

    // ── Home ─────────────────────────────────────────────────
    "/home/circles/{circleId}": {
      get: {
        tags: ["Home"],
        summary: "Get the aggregated home-screen dashboard for a circle",
        parameters: [uuidParam("circleId", "Circle ID")],
        responses: { "200": okResponse("Dashboard"), ...errorResponses(401, 403, 404) },
      },
    },

    // ── Location ─────────────────────────────────────────────
    "/location/ping": {
      post: {
        tags: ["Location"],
        summary: "Record caller's current location",
        requestBody: jsonBody({
          type: "object",
          required: ["lat", "lng"],
          properties: {
            lat: { type: "number", minimum: -90, maximum: 90 },
            lng: { type: "number", minimum: -180, maximum: 180 },
            accuracy: { type: "number", minimum: 0 },
            batteryPct: { type: "integer", minimum: 0, maximum: 100 },
          },
        }),
        responses: {
          "202": okResponse("Recorded", { type: "object", properties: { message: { type: "string" } } }),
          ...errorResponses(400, 401),
        },
      },
    },
    "/location/circles/{circleId}/members/{userId}": {
      get: {
        tags: ["Location"],
        summary: "Get a member's latest known location",
        parameters: [uuidParam("circleId", "Circle ID"), uuidParam("userId", "User ID")],
        responses: { "200": okResponse("Latest location"), ...errorResponses(401, 403, 404) },
      },
    },
    "/location/circles/{circleId}/members/{userId}/history": {
      get: {
        tags: ["Location"],
        summary: "Get a member's location history (within the retention window)",
        parameters: [uuidParam("circleId", "Circle ID"), uuidParam("userId", "User ID")],
        responses: {
          "200": okResponse("History", { type: "array", items: { type: "object" } }),
          ...errorResponses(401, 403, 404),
        },
      },
    },
    "/location/circles/{circleId}/retention": {
      patch: {
        tags: ["Location"],
        summary: "Update the circle's location history retention window",
        parameters: [uuidParam("circleId", "Circle ID")],
        requestBody: jsonBody({
          type: "object",
          required: ["retentionDays"],
          properties: { retentionDays: { type: "integer", minimum: 1, maximum: 30 } },
        }),
        responses: { "200": okResponse("Updated setting"), ...errorResponses(400, 401, 403, 404) },
      },
    },
    "/location/circles/{circleId}/safe-places": {
      post: {
        tags: ["Location"],
        summary: "Create a geofenced safe place",
        parameters: [uuidParam("circleId", "Circle ID")],
        requestBody: jsonBody({
          type: "object",
          required: ["name", "lat", "lng", "radiusM"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 80 },
            lat: { type: "number", minimum: -90, maximum: 90 },
            lng: { type: "number", minimum: -180, maximum: 180 },
            radiusM: { type: "integer", minimum: 50, maximum: 500 },
          },
        }),
        responses: { "201": okResponse("Created safe place"), ...errorResponses(400, 401, 403, 404) },
      },
      get: {
        tags: ["Location"],
        summary: "List safe places for a circle",
        parameters: [uuidParam("circleId", "Circle ID")],
        responses: {
          "200": okResponse("Safe places", { type: "array", items: { type: "object" } }),
          ...errorResponses(401, 403, 404),
        },
      },
    },
    "/location/circles/{circleId}/safe-places/{safePlaceId}": {
      delete: {
        tags: ["Location"],
        summary: "Delete a safe place",
        parameters: [uuidParam("circleId", "Circle ID"), uuidParam("safePlaceId", "Safe place ID")],
        responses: { "204": { description: "Deleted" }, ...errorResponses(401, 403, 404) },
      },
    },

    // ── Messages ─────────────────────────────────────────────
    "/messages/conversations": {
      post: {
        tags: ["Messages"],
        summary: "Create a conversation within a circle",
        requestBody: jsonBody({
          type: "object",
          required: ["circleId", "participantIds"],
          properties: {
            circleId: { type: "string", format: "uuid" },
            participantIds: { type: "array", minItems: 1, items: { type: "string", format: "uuid" } },
            isGroup: { type: "boolean", default: false },
          },
        }),
        responses: { "201": okResponse("Created conversation"), ...errorResponses(400, 401, 403) },
      },
      get: {
        tags: ["Messages"],
        summary: "List caller's conversations",
        responses: {
          "200": okResponse("Conversations", { type: "array", items: { type: "object" } }),
          ...errorResponses(401),
        },
      },
    },
    "/messages/conversations/{conversationId}/messages": {
      post: {
        tags: ["Messages"],
        summary: "Send a message, optionally with a live-location share",
        parameters: [uuidParam("conversationId", "Conversation ID")],
        requestBody: jsonBody({
          type: "object",
          required: ["body"],
          properties: {
            body: { type: "string", minLength: 1, maxLength: 4000 },
            locationShare: { type: "string", enum: ["15m", "1h", "untilOff"] },
          },
        }),
        responses: { "201": okResponse("Created message"), ...errorResponses(400, 401, 403, 404) },
      },
      get: {
        tags: ["Messages"],
        summary: "List messages in a conversation (paginated backward)",
        parameters: [
          uuidParam("conversationId", "Conversation ID"),
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } },
          { name: "before", in: "query", schema: { type: "string", format: "date-time" } },
        ],
        responses: {
          "200": okResponse("Messages", { type: "array", items: { type: "object" } }),
          ...errorResponses(401, 403, 404),
        },
      },
    },
    "/messages/conversations/{conversationId}/messages/{messageId}/stop-location-share": {
      post: {
        tags: ["Messages"],
        summary: "Stop an in-progress live location share on a message",
        parameters: [uuidParam("conversationId", "Conversation ID"), uuidParam("messageId", "Message ID")],
        responses: { "200": okResponse("Updated message"), ...errorResponses(401, 403, 404) },
      },
    },

    // ── Privacy Center ───────────────────────────────────────
    "/privacy-center/circles/{circleId}": {
      get: {
        tags: ["Privacy Center"],
        summary: "Get the privacy summary for a circle (what's visible to whom)",
        parameters: [uuidParam("circleId", "Circle ID")],
        responses: { "200": okResponse("Privacy entries"), ...errorResponses(401, 403, 404) },
      },
    },

    // ── Reassurance ──────────────────────────────────────────
    "/reassurance/check-in": {
      post: {
        tags: ["Reassurance"],
        summary: "Record an \"I'm OK\" check-in",
        requestBody: jsonBody({
          type: "object",
          required: ["circleId"],
          properties: { circleId: { type: "string", format: "uuid" } },
        }),
        responses: { "201": okResponse("Created check-in"), ...errorResponses(400, 401, 403) },
      },
    },
    "/reassurance/circles/{circleId}/history": {
      get: {
        tags: ["Reassurance"],
        summary: "List check-in history for a circle",
        parameters: [uuidParam("circleId", "Circle ID")],
        responses: {
          "200": okResponse("Check-ins", { type: "array", items: { type: "object" } }),
          ...errorResponses(401, 403, 404),
        },
      },
    },
    "/reassurance/reminders": {
      post: {
        tags: ["Reassurance"],
        summary: "Schedule a check-in reminder",
        requestBody: jsonBody({
          type: "object",
          required: ["remindAt"],
          properties: { remindAt: { type: "string", format: "date-time" } },
        }),
        responses: { "201": okResponse("Created reminder"), ...errorResponses(400, 401) },
      },
      get: {
        tags: ["Reassurance"],
        summary: "List caller's reminders",
        responses: {
          "200": okResponse("Reminders", { type: "array", items: { type: "object" } }),
          ...errorResponses(401),
        },
      },
    },
    "/reassurance/reminders/{reminderId}": {
      delete: {
        tags: ["Reassurance"],
        summary: "Delete a reminder",
        parameters: [uuidParam("reminderId", "Reminder ID")],
        responses: { "204": { description: "Deleted" }, ...errorResponses(401, 404) },
      },
    },

    // ── SOS ──────────────────────────────────────────────────
    "/sos/trigger": {
      post: {
        tags: ["SOS"],
        summary: "Trigger an SOS emergency event for a circle",
        requestBody: jsonBody({
          type: "object",
          required: ["circleId"],
          properties: { circleId: { type: "string", format: "uuid" } },
        }),
        responses: { "201": okResponse("Created SOS event"), ...errorResponses(400, 401, 403) },
      },
    },
    "/sos/{sosEventId}/acknowledge": {
      post: {
        tags: ["SOS"],
        summary: "Acknowledge an SOS event",
        parameters: [uuidParam("sosEventId", "SOS event ID")],
        responses: { "200": okResponse("Updated SOS event"), ...errorResponses(401, 403, 404) },
      },
    },
    "/sos/{sosEventId}/resolve": {
      post: {
        tags: ["SOS"],
        summary: "Resolve/close an SOS event",
        parameters: [uuidParam("sosEventId", "SOS event ID")],
        responses: { "200": okResponse("Updated SOS event"), ...errorResponses(401, 403, 404) },
      },
    },
    "/sos/{sosEventId}/log": {
      get: {
        tags: ["SOS"],
        summary: "Get the timeline/audit log of an SOS event",
        parameters: [uuidParam("sosEventId", "SOS event ID")],
        responses: { "200": okResponse("SOS event log"), ...errorResponses(401, 403, 404) },
      },
    },

    // ── Subscription ─────────────────────────────────────────
    "/subscription/plans": {
      get: {
        tags: ["Subscription"],
        summary: "List available subscription plans (public)",
        security: [],
        responses: { "200": okResponse("Plans", { type: "array", items: { type: "object" } }) },
      },
    },
    "/subscription/circles/{circleId}": {
      get: {
        tags: ["Subscription"],
        summary: "Get a circle's current subscription",
        parameters: [uuidParam("circleId", "Circle ID")],
        responses: { "200": okResponse("Subscription"), ...errorResponses(401, 403, 404) },
      },
      patch: {
        tags: ["Subscription"],
        summary: "Change a circle's subscription tier",
        parameters: [uuidParam("circleId", "Circle ID")],
        requestBody: jsonBody({
          type: "object",
          required: ["tier", "billingProvider"],
          properties: {
            tier: { type: "string", enum: ["FREE", "PREMIUM", "ENTERPRISE"] },
            billingProvider: { type: "string", enum: ["APPLE_IAP", "GOOGLE_IAP", "PAYSTACK", "FLUTTERWAVE"] },
          },
        }),
        responses: { "200": okResponse("Updated subscription"), ...errorResponses(400, 401, 403, 404) },
      },
    },
    "/subscription/circles/{circleId}/invoices": {
      get: {
        tags: ["Subscription"],
        summary: "List billing invoices for a circle",
        parameters: [uuidParam("circleId", "Circle ID")],
        responses: {
          "200": okResponse("Invoices", { type: "array", items: { type: "object" } }),
          ...errorResponses(401, 403, 404),
        },
      },
    },

    // ── Users ────────────────────────────────────────────────
    "/users/me": {
      get: {
        tags: ["Users"],
        summary: "Get caller's own profile",
        responses: { "200": okResponse("User profile"), ...errorResponses(401) },
      },
      patch: {
        tags: ["Users"],
        summary: "Update caller's profile",
        requestBody: jsonBody({
          type: "object",
          properties: {
            name: { type: "string", minLength: 1, maxLength: 80 },
            avatarUrl: { type: "string", format: "uri" },
            emergencyContacts: {
              type: "array",
              items: {
                type: "object",
                required: ["name", "phone"],
                properties: {
                  name: { type: "string", minLength: 1 },
                  phone: { type: "string", minLength: 1 },
                  relationship: { type: "string" },
                },
              },
            },
            medicalInfo: { type: "string", maxLength: 2000, nullable: true },
          },
        }),
        responses: { "200": okResponse("Updated profile"), ...errorResponses(400, 401) },
      },
    },
  },
};
