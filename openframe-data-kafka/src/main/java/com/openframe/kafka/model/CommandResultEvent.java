package com.openframe.kafka.model;

import lombok.Data;

/**
 * Kafka event carrying the result of a dispatched RMM command, produced by the
 * client-service after consuming the agent's {@code command-result} NATS
 * message. Downstream the stream-service enriches/persists it (separate task).
 *
 * <p>Lives in {@code com.openframe.kafka.model} so it falls under the
 * {@code spring.json.trusted.packages} allow-list used by consumers.
 */
@Data
public class CommandResultEvent implements KafkaMessage {

    private String machineId;
    private String executionId;
    private String status;
    private String result;
    private Long eventTimestamp;
}
