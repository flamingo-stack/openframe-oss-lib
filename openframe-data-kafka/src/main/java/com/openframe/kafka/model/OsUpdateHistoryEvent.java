package com.openframe.kafka.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.openframe.kafka.model.debezium.DebeziumMessage;
import lombok.Data;

// One install or uninstall of an OS update on a device, as the device reported it in its update history.
// Published by the client-service when the entry is stored for the first time; the stream-service turns it
// into a log event.
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class OsUpdateHistoryEvent extends DebeziumMessage<OsUpdateHistoryEvent> implements KafkaMessage {

    private String tenantId;
    private String machineId;
    private String entryKey;
    private String identifier;
    private String title;
    private String operation;
    private String result;
    private String errorCode;
    private Long installedAt;
}
