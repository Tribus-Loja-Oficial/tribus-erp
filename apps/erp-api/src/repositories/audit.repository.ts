import { eq, desc, and } from "drizzle-orm";
import type { AppDb } from "../db/client.js";
import {
  auditLogs,
  integrationEvents,
  type IntegrationEvent,
  type NewAuditLog,
  type NewIntegrationEvent,
} from "../db/schema/index.js";

export function createAuditRepository(db: AppDb) {
  return {
    async insert(data: NewAuditLog) {
      const result = await db.insert(auditLogs).values(data).returning();
      if (!result[0]) throw new Error("Failed to insert audit log");
      return result[0];
    },

    async findByEntity(entityType: string, entityId: string, limit = 50) {
      return db
        .select()
        .from(auditLogs)
        .where(and(eq(auditLogs.entityType, entityType), eq(auditLogs.entityId, entityId)))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit);
    },

    async findRecent(limit = 50) {
      return db
        .select()
        .from(auditLogs)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit);
    },

    async insertIntegrationEvent(data: NewIntegrationEvent) {
      const result = await db.insert(integrationEvents).values(data).returning();
      if (!result[0]) throw new Error("Failed to insert integration event");
      return result[0];
    },

    async findIntegrationEventByExternal(sourceSystem: string, eventType: string, externalId: string) {
      const result = await db
        .select()
        .from(integrationEvents)
        .where(
          and(
            eq(integrationEvents.sourceSystem, sourceSystem),
            eq(integrationEvents.eventType, eventType),
            eq(integrationEvents.externalId, externalId),
          ),
        )
        .limit(1);
      return result[0] ?? null;
    },

    async updateIntegrationEvent(
      id: string,
      data: Pick<Partial<IntegrationEvent>, "status" | "errorMessage" | "processedAt">,
    ) {
      await db
        .update(integrationEvents)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(integrationEvents.id, id));
    },
  };
}
