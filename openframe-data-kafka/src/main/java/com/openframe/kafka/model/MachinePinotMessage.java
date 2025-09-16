package com.openframe.kafka.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Message model for machine events sent to Kafka.
 * This message is sent when changes occur in Machine, MachineTag, or Tag collections.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MachinePinotMessage implements KafkaMessage {

    private String machineId;
    private String organizationId;
    private String deviceType;
    private String status;
    private String osType;
    private List<String> tags;
}
