package com.openframe.kafka.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import lombok.Data;

@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ScriptResultEvent extends DebeziumMessage<ScriptResultEvent> implements KafkaMessage {
}
