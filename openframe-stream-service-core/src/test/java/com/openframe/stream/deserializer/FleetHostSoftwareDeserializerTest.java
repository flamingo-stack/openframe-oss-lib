package com.openframe.stream.deserializer;

import com.openframe.data.model.enums.IntegratedToolType;
import com.openframe.data.model.enums.MessageType;
import com.openframe.kafka.model.debezium.CommonDebeziumMessage;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

class FleetHostSoftwareDeserializerTest {

    private static final long COMMIT_TS = 1_793_900_000_000L;

    private final ObjectMapper mapper = new JsonMapper();
    private final FleetHostSoftwareDeserializer deserializer = new FleetHostSoftwareDeserializer();

    private CommonDebeziumMessage message(String operation, JsonNode before, JsonNode after) {
        DebeziumMessage.Payload<JsonNode> payload = new DebeziumMessage.Payload<>();
        payload.setOperation(operation);
        payload.setBefore(before);
        payload.setAfter(after);
        payload.setTimestamp(COMMIT_TS);
        CommonDebeziumMessage message = new CommonDebeziumMessage();
        message.setPayload(payload);
        return message;
    }

    private JsonNode row(long hostId) {
        return mapper.createObjectNode().put("host_id", hostId).put("software_id", 9);
    }

    @Test
    void deserialize_insert_keepsThePayloadForTheHandlerWithNoTenant() {
        // setup
        CommonDebeziumMessage message = message("c", null, row(7));

        // execution
        DeserializedDebeziumMessage result = deserializer.deserialize(message, MessageType.FLEET_MDM_HOST_SOFTWARE_EVENT);

        // verifications
        assertThat(result.getPayload()).isSameAs(message.getPayload());
        assertThat(result.getIntegratedToolType()).isEqualTo(IntegratedToolType.FLEET);
        assertThat(result.getEventTimestamp()).isEqualTo(COMMIT_TS);
        assertThat(result.getTenantId()).isNull();
    }

    @Test
    void deserialize_deleteWithTheRowInBefore_isKept() {
        // setup
        CommonDebeziumMessage message = message("d", row(7), mapper.nullNode());

        // execution
        DeserializedDebeziumMessage result = deserializer.deserialize(message, MessageType.FLEET_MDM_HOST_SOFTWARE_EVENT);

        // verifications
        assertThat(result).isNotNull();
        assertThat(result.getPayload().getBefore().get("host_id").asLong()).isEqualTo(7);
    }

    @Test
    void deserialize_noRowOnEitherSide_isSkipped() {
        // setup
        CommonDebeziumMessage message = message("d", null, null);

        // execution
        DeserializedDebeziumMessage result = deserializer.deserialize(message, MessageType.FLEET_MDM_HOST_SOFTWARE_EVENT);

        // verifications
        assertThat(result).isNull();
    }
}
