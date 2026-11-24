package com.openframe.stream.deserializer;

import com.openframe.data.model.enums.DataEnrichmentServiceType;
import com.openframe.data.model.enums.IntegratedToolType;
import com.openframe.data.model.enums.MessageType;
import com.openframe.data.model.enums.Severity;
import com.openframe.data.model.enums.UnifiedEventType;
import com.openframe.kafka.model.OsUpdateHistoryEvent;
import com.openframe.kafka.model.debezium.CommonDebeziumMessage;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class OsUpdateHistoryEventDeserializerTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String MACHINE_ID = "machine-1";
    private static final String IDENTIFIER = "ffeeddcc-1111-2222-3333-445566778899:198";
    private static final String TITLE = "2026-10 Cumulative Update for Windows 11 Version 24H2 (KB5049981)";
    private static final long INSTALLED_AT = Instant.parse("2026-11-15T03:12:44.250Z").toEpochMilli();
    private static final long PUBLISHED_AT = Instant.parse("2026-11-20T09:14:03.120Z").toEpochMilli();
    private static final String ENTRY_KEY = IDENTIFIER + "|" + INSTALLED_AT + "|INSTALL";
    private static final JsonMapper JSON = new JsonMapper();

    private OsUpdateHistoryEventDeserializer deserializer;

    private OsUpdateHistoryEvent event;

    @BeforeEach
    void setUp() {
        deserializer = new OsUpdateHistoryEventDeserializer(JSON);
        event = new OsUpdateHistoryEvent();
        event.setTenantId(TENANT_ID);
        event.setMachineId(MACHINE_ID);
        event.setEntryKey(ENTRY_KEY);
        event.setIdentifier(IDENTIFIER);
        event.setTitle(TITLE);
        event.setOperation("INSTALL");
        event.setResult("SUCCEEDED");
        event.setInstalledAt(INSTALLED_AT);
    }

    @Test
    void getType_osUpdateHistoryEventOfTheRmmEnrichedAsAnRmmResult() {
        // setup

        // execution
        MessageType type = deserializer.getType();

        // verifications
        assertThat(type).isEqualTo(MessageType.OS_UPDATE_HISTORY_EVENT);
        assertThat(type.getIntegratedToolType()).isEqualTo(IntegratedToolType.RMM);
        assertThat(type.getDataEnrichmentServiceType()).isEqualTo(DataEnrichmentServiceType.RMM_RESULTS);
    }

    @ParameterizedTest
    @CsvSource({
            "INSTALL,   SUCCEEDED,             os_update.installed,        OS_UPDATE_INSTALLED,        INFO",
            "INSTALL,   SUCCEEDED_WITH_ERRORS, os_update.installed,        OS_UPDATE_INSTALLED,        INFO",
            "INSTALL,   FAILED,                os_update.install_failed,   OS_UPDATE_INSTALL_FAILED,   ERROR",
            "INSTALL,   ABORTED,               os_update.install_failed,   OS_UPDATE_INSTALL_FAILED,   ERROR",
            "UNINSTALL, SUCCEEDED,             os_update.uninstalled,      OS_UPDATE_UNINSTALLED,      INFO",
            "UNINSTALL, SUCCEEDED_WITH_ERRORS, os_update.uninstalled,      OS_UPDATE_UNINSTALLED,      INFO",
            "UNINSTALL, FAILED,                os_update.uninstall_failed, OS_UPDATE_UNINSTALL_FAILED, ERROR",
            "UNINSTALL, ABORTED,               os_update.uninstall_failed, OS_UPDATE_UNINSTALL_FAILED, ERROR"
    })
    void deserialize_operationAndResult_sourceEventTypeUnifiedTypeAndSeverityOfThatOutcome(
            String operation, String result, String expectedSourceEventType, UnifiedEventType expectedUnifiedType,
            Severity expectedSeverity) {
        // setup
        event.setOperation(operation);
        event.setResult(result);
        CommonDebeziumMessage message = message(event);

        // execution
        DeserializedDebeziumMessage deserialized = deserializer.deserialize(message, MessageType.OS_UPDATE_HISTORY_EVENT);

        // verifications
        assertThat(deserialized.getSourceEventType()).isEqualTo(expectedSourceEventType);
        assertThat(deserialized.getUnifiedEventType()).isEqualTo(expectedUnifiedType);
        assertThat(deserialized.getUnifiedEventType().getSeverity()).isEqualTo(expectedSeverity);
        assertThat(deserialized.getIntegratedToolType()).isEqualTo(IntegratedToolType.RMM);
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "INSTALL   | SUCCEEDED             | OS update installed: KB5049981",
            "INSTALL   | SUCCEEDED_WITH_ERRORS | OS update installed: KB5049981",
            "UNINSTALL | SUCCEEDED             | OS update uninstalled: KB5049981",
            "INSTALL   | FAILED                | OS update failed to install: KB5049981 (0x80240017)",
            "INSTALL   | ABORTED               | OS update failed to install: KB5049981 (0x80240017)",
            "UNINSTALL | FAILED                | OS update failed to uninstall: KB5049981 (0x80240017)"
    })
    void getMessage_titledUpdateWithAnErrorCode_saysWhatHappenedAndShowsTheCodeOnlyForAFailure(
            String operation, String result, String expectedMessage) {
        // setup
        event.setTitle("KB5049981");
        event.setOperation(operation);
        event.setResult(result);
        event.setErrorCode("0x80240017");
        JsonNode after = after(event);

        // execution
        Optional<String> message = deserializer.getMessage(after);

        // verifications
        assertThat(message).contains(expectedMessage);
    }

    @Test
    void getMessage_failureWithoutAnErrorCode_noCodeInTheMessage() {
        // setup
        event.setResult("FAILED");
        JsonNode after = after(event);

        // execution
        Optional<String> message = deserializer.getMessage(after);

        // verifications
        assertThat(message).contains("OS update failed to install: " + TITLE);
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "SUCCEEDED | OS update installed: an OS update",
            "FAILED    | OS update failed to install: an OS update (0x80240017)"
    })
    void getMessage_updateWithoutATitle_namedAnOsUpdate(String result, String expectedMessage) {
        // setup
        event.setTitle(null);
        event.setResult(result);
        event.setErrorCode("0x80240017");
        JsonNode after = after(event);

        // execution
        Optional<String> message = deserializer.getMessage(after);

        // verifications
        assertThat(message).contains(expectedMessage);
    }

    @Test
    void deserialize_event_timestampIsTheInstallTimeNotThePublishTime() {
        // setup
        CommonDebeziumMessage message = message(event);

        // execution
        DeserializedDebeziumMessage deserialized = deserializer.deserialize(message, MessageType.OS_UPDATE_HISTORY_EVENT);

        // verifications
        assertThat(deserialized.getEventTimestamp()).isEqualTo(INSTALLED_AT);
        assertThat(deserialized.getIngestDay()).contains("2026-11-15");
    }

    @Test
    void deserialize_eventWithoutAnInstallTime_timestampFallsBackToThePublishTime() {
        // setup
        event.setInstalledAt(null);
        CommonDebeziumMessage message = message(event);

        // execution
        DeserializedDebeziumMessage deserialized = deserializer.deserialize(message, MessageType.OS_UPDATE_HISTORY_EVENT);

        // verifications
        assertThat(deserialized.getEventTimestamp()).isEqualTo(PUBLISHED_AT);
    }

    @Test
    void deserialize_event_tenantAndAgentAreTheOnesOfTheReportingMachine() {
        // setup
        CommonDebeziumMessage message = message(event);

        // execution
        DeserializedDebeziumMessage deserialized = deserializer.deserialize(message, MessageType.OS_UPDATE_HISTORY_EVENT);

        // verifications
        assertThat(deserialized.getTenantId()).isEqualTo(TENANT_ID);
        assertThat(deserialized.getAgentId()).isEqualTo(MACHINE_ID);
        assertThat(deserialized.getSkipProcessing()).isFalse();
        assertThat(deserialized.getIsVisible()).isTrue();
    }

    @Test
    void getEventToolId_event_machineIdThenEntryKey() {
        // setup
        JsonNode after = after(event);

        // execution
        Optional<String> eventToolId = deserializer.getEventToolId(after);

        // verifications
        assertThat(eventToolId).contains(MACHINE_ID + ":" + ENTRY_KEY);
    }

    @ParameterizedTest
    @CsvSource({
            "machine-1,          ",
            "         , entry-key",
            "         ,          "
    })
    void getEventToolId_machineIdOrEntryKeyMissing_emptyForTheHashFallback(String machineId, String entryKey) {
        // setup
        event.setMachineId(machineId);
        event.setEntryKey(entryKey);
        JsonNode after = after(event);

        // execution
        Optional<String> eventToolId = deserializer.getEventToolId(after);

        // verifications
        assertThat(eventToolId).isEmpty();
    }

    @Test
    void deserialize_sameEntryPublishedAgainLater_sameToolEventId() {
        // setup
        CommonDebeziumMessage first = message(event);
        CommonDebeziumMessage again = message(event);
        again.getPayload().setTimestamp(PUBLISHED_AT + 86_400_000L);

        // execution
        DeserializedDebeziumMessage firstDeserialized = deserializer.deserialize(first, MessageType.OS_UPDATE_HISTORY_EVENT);
        DeserializedDebeziumMessage againDeserialized = deserializer.deserialize(again, MessageType.OS_UPDATE_HISTORY_EVENT);

        // verifications
        assertThat(againDeserialized.getToolEventId()).isNotBlank().isEqualTo(firstDeserialized.getToolEventId());
    }

    @Test
    void deserialize_anotherEntryOfTheMachineAndTheSameEntryOfAnotherMachine_differentToolEventIds() {
        // setup
        CommonDebeziumMessage entry = message(event);
        event.setEntryKey(IDENTIFIER + "|" + INSTALLED_AT + "|UNINSTALL");
        CommonDebeziumMessage anotherEntry = message(event);
        event.setEntryKey(ENTRY_KEY);
        event.setMachineId("machine-2");
        CommonDebeziumMessage sameEntryOfAnotherMachine = message(event);

        // execution
        String toolEventId = deserializer.deserialize(entry, MessageType.OS_UPDATE_HISTORY_EVENT).getToolEventId();
        String ofAnotherEntry =
                deserializer.deserialize(anotherEntry, MessageType.OS_UPDATE_HISTORY_EVENT).getToolEventId();
        String ofAnotherMachine =
                deserializer.deserialize(sameEntryOfAnotherMachine, MessageType.OS_UPDATE_HISTORY_EVENT).getToolEventId();

        // verifications
        assertThat(toolEventId).isNotEqualTo(ofAnotherEntry).isNotEqualTo(ofAnotherMachine);
        assertThat(ofAnotherEntry).isNotEqualTo(ofAnotherMachine);
    }

    @Test
    void deserialize_failedInstall_detailsCarryTheIdentifierOperationResultAndErrorCode() {
        // setup
        event.setResult("FAILED");
        event.setErrorCode("0x80240017");
        CommonDebeziumMessage message = message(event);
        ObjectNode expectedDetails = JSON.createObjectNode();
        expectedDetails.putObject("additional_info")
                .put("identifier", IDENTIFIER)
                .put("operation", "INSTALL")
                .put("result", "FAILED")
                .put("error_code", "0x80240017");

        // execution
        DeserializedDebeziumMessage deserialized = deserializer.deserialize(message, MessageType.OS_UPDATE_HISTORY_EVENT);

        // verifications
        assertThat(JSON.readTree(deserialized.getDetails())).isEqualTo(expectedDetails);
    }

    @Test
    void deserialize_succeededInstall_detailsWithoutAnErrorCode() {
        // setup
        CommonDebeziumMessage message = message(event);
        ObjectNode expectedDetails = JSON.createObjectNode();
        expectedDetails.putObject("additional_info")
                .put("identifier", IDENTIFIER)
                .put("operation", "INSTALL")
                .put("result", "SUCCEEDED");

        // execution
        DeserializedDebeziumMessage deserialized = deserializer.deserialize(message, MessageType.OS_UPDATE_HISTORY_EVENT);

        // verifications
        assertThat(JSON.readTree(deserialized.getDetails())).isEqualTo(expectedDetails);
    }

    @Test
    void getDetails_eventWithNoneOfTheDetailFields_null() {
        // setup
        JsonNode after = JSON.createObjectNode().put("machineId", MACHINE_ID);

        // execution
        String details = deserializer.getDetails(after);

        // verifications
        assertThat(details).isNull();
    }

    @Test
    void deserialize_messageWithoutAnAfterState_null() {
        // setup
        CommonDebeziumMessage message = message(event);
        message.getPayload().setAfter(null);

        // execution
        DeserializedDebeziumMessage deserialized = deserializer.deserialize(message, MessageType.OS_UPDATE_HISTORY_EVENT);

        // verifications
        assertThat(deserialized).isNull();
    }

    private static JsonNode after(OsUpdateHistoryEvent event) {
        return JSON.valueToTree(event);
    }

    private static CommonDebeziumMessage message(OsUpdateHistoryEvent event) {
        DebeziumMessage.Payload<JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setAfter(after(event));
        payload.setOperation("c");
        payload.setTimestamp(PUBLISHED_AT);
        CommonDebeziumMessage message = new CommonDebeziumMessage();
        message.setPayload(payload);
        return message;
    }
}
