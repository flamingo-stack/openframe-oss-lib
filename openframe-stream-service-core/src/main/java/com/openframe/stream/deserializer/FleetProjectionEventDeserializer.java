package com.openframe.stream.deserializer;

import com.openframe.data.model.enums.IntegratedToolType;
import com.openframe.data.model.enums.MessageType;
import com.openframe.kafka.model.debezium.CommonDebeziumMessage;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import tools.jackson.databind.JsonNode;

public abstract class FleetProjectionEventDeserializer implements KafkaMessageDeserializer {

    @Override
    public DeserializedDebeziumMessage deserialize(CommonDebeziumMessage message, MessageType type) {
        DebeziumMessage.Payload<JsonNode> payload = message == null ? null : message.getPayload();
        JsonNode row = rowOf(payload);
        if (row == null) {
            return null;
        }
        return DeserializedDebeziumMessage.builder()
                .payload(payload)
                .integratedToolType(IntegratedToolType.FLEET)
                .tenantId(teamId(row))
                .eventTimestamp(payload.getTimestamp())
                .build();
    }

    //Delete events carry the row in before; everything else in after
    private JsonNode rowOf(DebeziumMessage.Payload<JsonNode> payload) {
        if (payload == null) {
            return null;
        }
        JsonNode after = payload.getAfter();
        if (after != null && !after.isNull()) {
            return after;
        }
        return payload.getBefore();
    }

    //Present on the host-count tables, absent on the global cve_meta rows
    private String teamId(JsonNode row) {
        JsonNode node = row.get("team_id");
        return node == null || node.isNull() ? null : node.asString();
    }
}
