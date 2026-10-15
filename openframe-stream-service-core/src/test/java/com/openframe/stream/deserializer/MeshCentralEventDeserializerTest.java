package com.openframe.stream.deserializer;

import com.openframe.data.cassandra.model.enums.UnifiedEventType;
import com.openframe.data.model.enums.MessageType;
import com.openframe.kafka.model.debezium.CommonDebeziumMessage;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.StringNode;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class MeshCentralEventDeserializerTest {

    private static final long PROCESSING_TIMESTAMP = 1791712805000L;
    private static final long EVENT_TIME = 1791712800000L;
    private static final String EVENT_OID = "6710a3f2c1d2e3f4a5b6c7d8";
    private static final String MESH_NODE_ID = "node//Xk3d0aBcQ2";
    private static final String TENANT_ID = "8c1d6f0e-4b7a-4a51-9f1e-2b3c4d5e6f70";
    private static final String CLIPBOARD_PASTE_JSON = """
            {
              "_id": {"$oid": "6710a3f2c1d2e3f4a5b6c7d8"},
              "etype": "node",
              "action": "agentlog",
              "nodeid": "node//Xk3d0aBcQ2",
              "domain": "8c1d6f0e-4b7a-4a51-9f1e-2b3c4d5e6f70",
              "msg": "Setting clipboard content, 17 byte(s)",
              "msgid": 22,
              "msgArgs": [17],
              "userid": "user/8c1d6f0e-4b7a-4a51-9f1e-2b3c4d5e6f70/openframe",
              "username": "openframe",
              "sessionid": "user/8c1d6f0e-4b7a-4a51-9f1e-2b3c4d5e6f70/openframe/a91f",
              "ids": ["node//Xk3d0aBcQ2"],
              "time": {"$date": 1791712800000}
            }
            """;
    private static final String CLIPBOARD_COPY_JSON = """
            {
              "_id": {"$oid": "6710a3f2c1d2e3f4a5b6c7d9"},
              "etype": "node",
              "action": "agentlog",
              "nodeid": "node//Xk3d0aBcQ2",
              "domain": "8c1d6f0e-4b7a-4a51-9f1e-2b3c4d5e6f70",
              "msg": "Getting clipboard content, 42 byte(s)",
              "msgid": 21,
              "msgArgs": [42],
              "userid": "user/8c1d6f0e-4b7a-4a51-9f1e-2b3c4d5e6f70/openframe",
              "time": {"$date": 1791712860000}
            }
            """;
    private static final String HELP_REQUEST_JSON = """
            {
              "_id": {"$oid": "6710a3f2c1d2e3f4a5b6c7da"},
              "etype": "node",
              "action": "agentlog",
              "nodeid": "node//Xk3d0aBcQ2",
              "domain": "8c1d6f0e-4b7a-4a51-9f1e-2b3c4d5e6f70",
              "msg": "Help Requested, user: alex, details: Printer is down",
              "msgid": 98,
              "msgArgs": ["alex", "Printer is down"],
              "time": {"$date": 1791712900000}
            }
            """;
    private static final String LOGIN_JSON = """
            {
              "_id": {"$oid": "6710a3f2c1d2e3f4a5b6c7db"},
              "etype": "user",
              "action": "login",
              "userid": "user/8c1d6f0e-4b7a-4a51-9f1e-2b3c4d5e6f70/openframe",
              "domain": "8c1d6f0e-4b7a-4a51-9f1e-2b3c4d5e6f70",
              "msg": "Account login",
              "time": {"$date": 1791712700000}
            }
            """;

    private final JsonMapper mapper = new JsonMapper();
    private final MeshCentralEventDeserializer deserializer = new MeshCentralEventDeserializer(mapper);

    @Test
    void shouldReadTheEventIdFromAnObjectIdOrAPlainValue() {
        assertThat(deserializer.getEventToolId(event("{\"_id\":{\"$oid\":\"abc\"}}"))).contains("abc");
        assertThat(deserializer.getEventToolId(event("{\"_id\":\"plain-id\"}"))).contains("plain-id");
    }

    @Test
    void shouldIgnoreFieldsOfAnUnexpectedTypeInsteadOfFailing() {
        // Jackson 3 asString() throws on an array or object where Jackson 2 returned ""
        JsonNode after = event("{\"_id\":[1,2],\"etype\":{\"x\":1},\"action\":\"login\",\"time\":{\"$date\":\"2026-10-12T10:00:00Z\"}}");

        assertThat(deserializer.getEventToolId(after)).isEmpty();
        assertThat(deserializer.getSourceEventType(after)).contains("login");
        assertThat(deserializer.getSourceEventTimestamp(after)).contains(0L);
    }

    @Test
    void shouldReadANumericEventTime() {
        assertThat(deserializer.getSourceEventTimestamp(event("{\"time\":{\"$date\":1760263200000}}"))).contains(1760263200000L);
    }

    @Test
    void deserialize_clipboardPaste_typedPastedWithMsgIdAndArgsInDetails() {
        // setup
        CommonDebeziumMessage message = message(CLIPBOARD_PASTE_JSON);
        String expectedToolEventId = UUID.nameUUIDFromBytes(
                ("meshcentral_events_id_" + EVENT_OID).getBytes(StandardCharsets.UTF_8)).toString();

        // execution
        DeserializedDebeziumMessage result = deserializer.deserialize(message, MessageType.MESHCENTRAL_EVENT);

        // verifications
        assertThat(result.getUnifiedEventType()).isEqualTo(UnifiedEventType.REMOTE_CLIPBOARD_PASTED);
        assertThat(result.getSourceEventType()).isEqualTo("node.agentlog");
        assertThat(result.getAgentId()).isEqualTo(MESH_NODE_ID);
        assertThat(result.getTenantId()).isEqualTo(TENANT_ID);
        assertThat(result.getEventTimestamp()).isEqualTo(EVENT_TIME);
        assertThat(result.getToolEventId()).isEqualTo(expectedToolEventId);
        assertThat(result.getMessage()).isEqualTo("Setting clipboard content, 17 byte(s)");
        assertThat(mapper.readTree(result.getDetails()))
                .isEqualTo(mapper.readTree("{\"additional_info\":{\"msgid\":22,\"msgArgs\":[17]}}"));
    }

    @Test
    void deserialize_clipboardCopy_typedCopied() {
        // setup
        CommonDebeziumMessage message = message(CLIPBOARD_COPY_JSON);

        // execution
        DeserializedDebeziumMessage result = deserializer.deserialize(message, MessageType.MESHCENTRAL_EVENT);

        // verifications
        assertThat(result.getUnifiedEventType()).isEqualTo(UnifiedEventType.REMOTE_CLIPBOARD_COPIED);
        assertThat(result.getMessage()).isEqualTo("Getting clipboard content, 42 byte(s)");
        assertThat(mapper.readTree(result.getDetails()))
                .isEqualTo(mapper.readTree("{\"additional_info\":{\"msgid\":21,\"msgArgs\":[42]}}"));
    }

    @Test
    void deserialize_otherAgentLog_fileOperationWithMsgIdKept() {
        // setup
        CommonDebeziumMessage message = message(HELP_REQUEST_JSON);

        // execution
        DeserializedDebeziumMessage result = deserializer.deserialize(message, MessageType.MESHCENTRAL_EVENT);

        // verifications
        assertThat(result.getUnifiedEventType()).isEqualTo(UnifiedEventType.FILE_OPERATION);
        assertThat(mapper.readTree(result.getDetails())).isEqualTo(mapper.readTree(
                "{\"additional_info\":{\"msgid\":98,\"msgArgs\":[\"alex\",\"Printer is down\"]}}"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"22.5", "\"22\""})
    void deserialize_nonIntegralMsgId_staysFileOperation(String msgId) {
        // setup
        CommonDebeziumMessage message = message(CLIPBOARD_PASTE_JSON.replace("\"msgid\": 22", "\"msgid\": " + msgId));

        // execution
        DeserializedDebeziumMessage result = deserializer.deserialize(message, MessageType.MESHCENTRAL_EVENT);

        // verifications
        assertThat(result.getUnifiedEventType()).isEqualTo(UnifiedEventType.FILE_OPERATION);
    }

    @Test
    void deserialize_eventWithoutMsgId_detailsEmpty() {
        // setup
        CommonDebeziumMessage message = message(LOGIN_JSON);

        // execution
        DeserializedDebeziumMessage result = deserializer.deserialize(message, MessageType.MESHCENTRAL_EVENT);

        // verifications
        assertThat(result.getUnifiedEventType()).isEqualTo(UnifiedEventType.LOGIN);
        assertThat(result.getDetails()).isEqualTo("{}");
    }

    private static CommonDebeziumMessage message(String afterJson) {
        DebeziumMessage.Payload.Source source = new DebeziumMessage.Payload.Source();
        source.setConnector("mongodb");
        source.setCollection("events");
        DebeziumMessage.Payload<JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setAfter(event(afterJson));
        payload.setSource(source);
        payload.setOperation("c");
        payload.setTimestamp(PROCESSING_TIMESTAMP);
        CommonDebeziumMessage message = new CommonDebeziumMessage();
        message.setPayload(payload);
        return message;
    }

    private static JsonNode event(String json) {
        // Debezium hands the MeshCentral document over as a JSON string
        return StringNode.valueOf(json);
    }
}
