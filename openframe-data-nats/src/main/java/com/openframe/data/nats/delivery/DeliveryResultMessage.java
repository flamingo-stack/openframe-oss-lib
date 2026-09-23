package com.openframe.data.nats.delivery;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.data.document.delivery.DeliveryType;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class DeliveryResultMessage {

    public static final String STREAM = "DELIVERY_RESULT";
    public static final String SUBJECT_FILTER = "machine.*.delivery.result";

    // a value this server does not know yet reads as null and is dropped with a warning instead of poisoning the consumer
    @JsonFormat(with = JsonFormat.Feature.READ_UNKNOWN_ENUM_VALUES_AS_NULL)
    private DeliveryType type;
    private String targetId;
    private String dispatchId;
    @JsonFormat(with = JsonFormat.Feature.READ_UNKNOWN_ENUM_VALUES_AS_NULL)
    private DeliveryResult result;
    private String error;
}
