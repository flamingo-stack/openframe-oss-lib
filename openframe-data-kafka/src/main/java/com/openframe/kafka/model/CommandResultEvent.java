package com.openframe.kafka.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.openframe.kafka.model.debezium.DebeziumMessage;
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
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CommandResultEvent extends DebeziumMessage<CommandResultEvent> implements KafkaMessage {

    private String machineId;
    private String executionId;
    private String stdout;
    private String stderr;
    private Integer exitCode;
    private Long executionTimeMs;
    private Boolean timedOut;
    private String error;
    private Long eventTimestamp;
}
