package com.openframe.stream.deserializer;

import com.openframe.data.model.enums.IntegratedToolType;
import com.openframe.data.model.enums.MessageType;
import com.openframe.kafka.model.debezium.CommonDebeziumMessage;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

// host_software and host_software_windows_details carry no team_id: DeviceSoftwareHandler resolves the tenant from host_id
@Component
public class FleetHostSoftwareDeserializer implements KafkaMessageDeserializer {

    @Override
    public MessageType getType() {
        return MessageType.FLEET_MDM_HOST_SOFTWARE_EVENT;
    }

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
}
