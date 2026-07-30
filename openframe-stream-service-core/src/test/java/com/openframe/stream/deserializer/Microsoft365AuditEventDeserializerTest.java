package com.openframe.stream.deserializer;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.cassandra.model.enums.UnifiedEventType;
import com.openframe.data.model.enums.IntegratedToolType;
import com.openframe.data.model.enums.MessageType;
import com.openframe.kafka.model.debezium.CommonDebeziumMessage;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class Microsoft365AuditEventDeserializerTest {

    private static final long PROCESSING_TS = 1753868000000L;

    private final ObjectMapper mapper = new ObjectMapper();
    private final Microsoft365AuditEventDeserializer deserializer = new Microsoft365AuditEventDeserializer(mapper);

    private static final String AUDIT_EVENT_JSON = """
            {
              "auditId": "Directory_abc_123", "activityDateTime": "2026-07-30T10:00:00Z",
              "activityDisplayName": "Add user", "category": "UserManagement", "result": "success",
              "initiatedBy": {"user": {"userPrincipalName": "admin@x.com", "id": "user-id-1"}},
              "targetResources": [{"displayName": "Test User", "type": "User", "id": "target-id-1"}],
              "additionalDetails": [{"key": "UserType", "value": "Member"}],
              "tenantId": "tenant-1", "organizationId": "org-uuid-1", "organizationName": "Acme Org"
            }
            """;

    private CommonDebeziumMessage message(String afterJson) {
        try {
            DebeziumMessage.Payload<JsonNode> payload = new DebeziumMessage.Payload<>();
            payload.setAfter(afterJson == null ? null : mapper.readTree(afterJson));
            payload.setOperation("c");
            payload.setTimestamp(PROCESSING_TS);
            CommonDebeziumMessage message = new CommonDebeziumMessage();
            message.setPayload(payload);
            return message;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private DeserializedDebeziumMessage deserialize(String afterJson) {
        return deserializer.deserialize(message(afterJson), MessageType.MICROSOFT_365_AUDIT_EVENT);
    }

    @Test
    void registersForMicrosoft365AuditEventType() {
        assertEquals(MessageType.MICROSOFT_365_AUDIT_EVENT, deserializer.getType());
    }

    @Test
    void mapsAuditFieldsToDeserializedMessage() {
        DeserializedDebeziumMessage result = deserialize(AUDIT_EVENT_JSON);

        assertEquals("Directory_abc_123", result.getToolEventId());
        assertEquals(Instant.parse("2026-07-30T10:00:00Z").toEpochMilli(), result.getEventTimestamp());
        assertEquals("2026-07-30", result.getIngestDay());
        assertEquals("Add user", result.getMessage());
        assertEquals("UserManagement", result.getSourceEventType());
        assertEquals(UnifiedEventType.M365_USER_MANAGEMENT, result.getUnifiedEventType());
        assertEquals(IntegratedToolType.MICROSOFT_365, result.getIntegratedToolType());
    }

    @Test
    void passesThroughTenantAndOrgFields() {
        DeserializedDebeziumMessage result = deserialize(AUDIT_EVENT_JSON);

        assertEquals("tenant-1", result.getTenantId());
        assertEquals("org-uuid-1", result.getOrganizationId());
        assertEquals("Acme Org", result.getOrganizationName());
    }

    @Test
    void extractsUserIdFromInitiatedByUserPrincipalName() {
        DeserializedDebeziumMessage result = deserialize(AUDIT_EVENT_JSON);

        assertEquals("admin@x.com", result.getUserId());
    }

    @Test
    void hasNoAgentAndIsVisible() {
        DeserializedDebeziumMessage result = deserialize(AUDIT_EVENT_JSON);

        assertNull(result.getAgentId());
        assertTrue(result.getIsVisible());
        assertFalse(result.getSkipProcessing());
    }

    @Test
    void detailsContainInitiatedByTargetResourcesAndAdditionalDetails() throws Exception {
        DeserializedDebeziumMessage result = deserialize(AUDIT_EVENT_JSON);

        JsonNode details = mapper.readTree(result.getDetails());
        assertEquals("admin@x.com", details.path("initiatedBy").path("user").path("userPrincipalName").asText());
        assertEquals("User", details.path("targetResources").path(0).path("type").asText());
        assertEquals("UserType", details.path("additionalDetails").path(0).path("key").asText());
    }

    @Test
    void failureResultMapsToAuditFailureRegardlessOfCategory() {
        String failed = AUDIT_EVENT_JSON.replace("\"result\": \"success\"", "\"result\": \"failure\"");

        DeserializedDebeziumMessage result = deserialize(failed);

        assertEquals(UnifiedEventType.M365_AUDIT_FAILURE, result.getUnifiedEventType());
    }

    @Test
    void timeoutResultMapsToAuditFailure() {
        String timedOut = AUDIT_EVENT_JSON.replace("\"result\": \"success\"", "\"result\": \"timeout\"");

        DeserializedDebeziumMessage result = deserialize(timedOut);

        assertEquals(UnifiedEventType.M365_AUDIT_FAILURE, result.getUnifiedEventType());
    }

    @Test
    void unmappedCategoryFallsBackToAuditOther() {
        String other = AUDIT_EVENT_JSON.replace("\"category\": \"UserManagement\"", "\"category\": \"KeyManagement\"");

        DeserializedDebeziumMessage result = deserialize(other);

        assertEquals(UnifiedEventType.M365_AUDIT_OTHER, result.getUnifiedEventType());
    }

    @Test
    void missingActivityDateTimeFallsBackToProcessingTimestamp() {
        String withoutTime = AUDIT_EVENT_JSON.replace("\"activityDateTime\": \"2026-07-30T10:00:00Z\",", "");

        DeserializedDebeziumMessage result = deserialize(withoutTime);

        assertEquals(PROCESSING_TS, result.getEventTimestamp());
    }

    @Test
    void nullAfterReturnsNull() {
        assertNull(deserialize(null));
    }
}
