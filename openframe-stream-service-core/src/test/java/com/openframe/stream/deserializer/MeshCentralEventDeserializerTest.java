package com.openframe.stream.deserializer;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.StringNode;

import static org.assertj.core.api.Assertions.assertThat;

class MeshCentralEventDeserializerTest {

    private final MeshCentralEventDeserializer deserializer = new MeshCentralEventDeserializer(new JsonMapper());

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

    private static JsonNode event(String json) {
        // Debezium hands the MeshCentral document over as a JSON string
        return StringNode.valueOf(json);
    }
}
