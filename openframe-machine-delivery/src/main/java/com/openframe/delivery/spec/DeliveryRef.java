package com.openframe.delivery.spec;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.openframe.data.document.delivery.DeliveryType;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class DeliveryRef {

    // a type this server does not know yet reads as null and the report is rejected instead of poisoning the consumer
    @JsonFormat(with = JsonFormat.Feature.READ_UNKNOWN_ENUM_VALUES_AS_NULL)
    private DeliveryType type;
    private String targetId;
    private String dispatchId;
    // monotonic per (type, targetId, machineId), stamped when the row is written, never by the caller: a state-like
    // type (update, toggle) drops anything below the last sequence it applied; a command runs every message
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private Integer sequence;

    public DeliveryRef(DeliveryType type, String targetId, String dispatchId) {
        this.type = type;
        this.targetId = targetId;
        this.dispatchId = dispatchId;
    }
}
