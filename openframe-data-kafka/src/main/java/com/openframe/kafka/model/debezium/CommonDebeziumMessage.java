package com.openframe.kafka.model.debezium;

import com.fasterxml.jackson.databind.JsonNode;
import com.openframe.kafka.model.CommonMessage;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@SuperBuilder
@Data
@NoArgsConstructor
public class CommonDebeziumMessage extends DebeziumMessage<JsonNode> implements CommonMessage {
}
