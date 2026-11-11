package com.openframe.stream.deserializer;

import com.openframe.data.cassandra.model.enums.UnifiedEventType;
import com.openframe.data.model.enums.IntegratedToolType;
import com.openframe.data.model.enums.MessageType;
import com.openframe.kafka.model.debezium.CommonDebeziumMessage;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class AccessChangeEventDeserializerTest {

    private static final long PROCESSING_TIMESTAMP = 1753868000000L;
    private static final String OCCURRED_AT = "2026-11-10T10:15:30Z";
    private static final String ACCESS_CHANGE_ID = "ac-1";
    private static final String TENANT_ID = "tenant-1";
    private static final String ORGANIZATION_ID = "org-1";
    private static final String ORGANIZATION_NAME = "Acme";
    private static final String PERSON_ID = "profile-1";
    private static final String PERSON_NAME = "Rhea Patel";
    private static final String CONNECTION_ID = "conn-1";
    private static final String EXTERNAL_KEY = "graph-id-1";
    private static final String SIGN_IN_NAME = "rhea@acme.com";

    private final ObjectMapper mapper = new JsonMapper();
    private final AccessChangeEventDeserializer deserializer = new AccessChangeEventDeserializer(mapper);

    private ObjectNode after;

    @BeforeEach
    void setUp() {
        after = mapper.createObjectNode()
                .put("accessChangeId", ACCESS_CHANGE_ID)
                .put("tenantId", TENANT_ID)
                .put("organizationId", ORGANIZATION_ID)
                .put("organizationName", ORGANIZATION_NAME)
                .put("action", "DIRECTORY_ACCOUNT_LINKED")
                .put("actorType", "SYNC")
                .put("targetPersonId", PERSON_ID)
                .put("targetPersonName", PERSON_NAME)
                .put("system", "MICROSOFT_365")
                .put("evidence", "VERIFIED_EMAIL")
                .put("connectionId", CONNECTION_ID)
                .put("externalKey", EXTERNAL_KEY)
                .put("signInName", SIGN_IN_NAME)
                .put("occurredAt", OCCURRED_AT);
    }

    @Test
    void getType_always_accessChangeEvent() {
        // execution
        MessageType type = deserializer.getType();

        // verifications
        assertThat(type).isEqualTo(MessageType.ACCESS_CHANGE_EVENT);
    }

    @Test
    void deserialize_profileCreated_tenantTimeActorPersonAndMessage() {
        // setup
        after.put("action", "PROFILE_CREATED").remove("evidence");
        CommonDebeziumMessage message = message(after);
        long occurredAt = Instant.parse(OCCURRED_AT).toEpochMilli();

        // execution
        DeserializedDebeziumMessage result = deserializer.deserialize(message, MessageType.ACCESS_CHANGE_EVENT);

        // verifications
        assertThat(result)
                .returns(TENANT_ID, DeserializedDebeziumMessage::getTenantId)
                .returns(ORGANIZATION_ID, DeserializedDebeziumMessage::getOrganizationId)
                .returns(ORGANIZATION_NAME, DeserializedDebeziumMessage::getOrganizationName)
                .returns(occurredAt, DeserializedDebeziumMessage::getEventTimestamp)
                .returns("2026-11-10", DeserializedDebeziumMessage::getIngestDay)
                .returns("PROFILE_CREATED", DeserializedDebeziumMessage::getSourceEventType)
                .returns(UnifiedEventType.IDENTITY_PROFILE_CREATED, DeserializedDebeziumMessage::getUnifiedEventType)
                .returns("Created profile for Rhea Patel from Microsoft 365", DeserializedDebeziumMessage::getMessage);
    }

    @Test
    void deserialize_profileCreated_detailsCarryActorPersonAndAccount() {
        // setup
        after.put("action", "PROFILE_CREATED").remove("evidence");
        CommonDebeziumMessage message = message(after);

        // execution
        DeserializedDebeziumMessage result = deserializer.deserialize(message, MessageType.ACCESS_CHANGE_EVENT);

        // verifications
        JsonNode details = mapper.readTree(result.getDetails());
        assertThat(details.path("actorType").asString()).isEqualTo("SYNC");
        assertThat(details.path("targetPersonId").asString()).isEqualTo(PERSON_ID);
        assertThat(details.path("system").asString()).isEqualTo("MICROSOFT_365");
        assertThat(details.path("connectionId").asString()).isEqualTo(CONNECTION_ID);
        assertThat(details.path("externalKey").asString()).isEqualTo(EXTERNAL_KEY);
        assertThat(details.path("signInName").asString()).isEqualTo(SIGN_IN_NAME);
    }

    @Test
    void deserialize_accountLinkedVerifiedEmail_linkedMessageWithVerifiedAddress() {
        // setup
        CommonDebeziumMessage message = message(after);

        // execution
        DeserializedDebeziumMessage result = deserializer.deserialize(message, MessageType.ACCESS_CHANGE_EVENT);

        // verifications
        assertThat(result)
                .returns(UnifiedEventType.IDENTITY_ACCOUNT_LINKED, DeserializedDebeziumMessage::getUnifiedEventType)
                .returns("Linked Microsoft 365 account to Rhea Patel (verified address)",
                        DeserializedDebeziumMessage::getMessage);
    }

    @Test
    void deserialize_accountLinkedSyncCreated_createdBySyncMessage() {
        // setup
        after.put("evidence", "SYNC_CREATED").put("system", "GOOGLE_WORKSPACE");
        CommonDebeziumMessage message = message(after);

        // execution
        DeserializedDebeziumMessage result = deserializer.deserialize(message, MessageType.ACCESS_CHANGE_EVENT);

        // verifications
        assertThat(result.getMessage())
                .isEqualTo("Linked Google Workspace account to Rhea Patel (created by the sync)");
    }

    @Test
    void deserialize_accountUnlinked_unlinkedEventTypeAndGoneReason() {
        // setup
        after.put("action", "DIRECTORY_ACCOUNT_UNLINKED").put("system", "GOOGLE_WORKSPACE")
                .put("reason", "GONE").remove("evidence");
        CommonDebeziumMessage message = message(after);

        // execution
        DeserializedDebeziumMessage result = deserializer.deserialize(message, MessageType.ACCESS_CHANGE_EVENT);

        // verifications
        assertThat(result)
                .returns(UnifiedEventType.IDENTITY_ACCOUNT_UNLINKED, DeserializedDebeziumMessage::getUnifiedEventType)
                .returns("Unlinked Google Workspace account from Rhea Patel (account gone)",
                        DeserializedDebeziumMessage::getMessage);
    }

    @Test
    void deserialize_unknownAction_skippedAsUnknownNotShownAsUnlink() {
        // setup
        after.put("action", "PROFILE_MERGED");
        CommonDebeziumMessage message = message(after);

        // execution
        DeserializedDebeziumMessage result = deserializer.deserialize(message, MessageType.ACCESS_CHANGE_EVENT);

        // verifications
        assertThat(result)
                .returns(true, DeserializedDebeziumMessage::getSkipProcessing)
                .returns(UnifiedEventType.UNKNOWN, DeserializedDebeziumMessage::getUnifiedEventType)
                .returns("Access change PROFILE_MERGED for Rhea Patel", DeserializedDebeziumMessage::getMessage);
    }

    @Test
    void deserialize_missingAction_skippedAsUnknown() {
        // setup
        after.remove("action");
        CommonDebeziumMessage message = message(after);

        // execution
        DeserializedDebeziumMessage result = deserializer.deserialize(message, MessageType.ACCESS_CHANGE_EVENT);

        // verifications
        assertThat(result)
                .returns(true, DeserializedDebeziumMessage::getSkipProcessing)
                .returns(UnifiedEventType.UNKNOWN, DeserializedDebeziumMessage::getUnifiedEventType);
    }

    @Test
    void deserialize_anyAction_noMachineNoAgentVisible() {
        // setup
        CommonDebeziumMessage message = message(after);

        // execution
        DeserializedDebeziumMessage result = deserializer.deserialize(message, MessageType.ACCESS_CHANGE_EVENT);

        // verifications
        assertThat(result)
                .returns(null, DeserializedDebeziumMessage::getAgentId)
                .returns(null, DeserializedDebeziumMessage::getMachineId)
                .returns(null, DeserializedDebeziumMessage::getUserId)
                .returns(true, DeserializedDebeziumMessage::getIsVisible)
                .returns(false, DeserializedDebeziumMessage::getSkipProcessing);
    }

    @Test
    void deserialize_anyAction_openframeToolAndOrganizationSuffixedToolEventId() {
        // setup
        CommonDebeziumMessage message = message(after);

        // execution
        DeserializedDebeziumMessage result = deserializer.deserialize(message, MessageType.ACCESS_CHANGE_EVENT);

        // verifications
        assertThat(result)
                .returns(IntegratedToolType.OPENFRAME, DeserializedDebeziumMessage::getIntegratedToolType)
                .returns("ac-1-org-1", DeserializedDebeziumMessage::getToolEventId);
    }

    @Test
    void deserialize_tenantLevelChange_bareToolEventIdNoOrganization() {
        // setup
        after.remove("organizationId");
        after.remove("organizationName");
        CommonDebeziumMessage message = message(after);

        // execution
        DeserializedDebeziumMessage result = deserializer.deserialize(message, MessageType.ACCESS_CHANGE_EVENT);

        // verifications
        assertThat(result)
                .returns(ACCESS_CHANGE_ID, DeserializedDebeziumMessage::getToolEventId)
                .returns(null, DeserializedDebeziumMessage::getOrganizationId);
    }

    private static CommonDebeziumMessage message(JsonNode after) {
        DebeziumMessage.Payload<JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setAfter(after);
        payload.setOperation("c");
        payload.setTimestamp(PROCESSING_TIMESTAMP);
        CommonDebeziumMessage message = new CommonDebeziumMessage();
        message.setPayload(payload);
        return message;
    }
}
