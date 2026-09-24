package com.openframe.data.nats.delivery;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.delivery.spec.DeliveryRef;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class DeliveryResultMessage {

    public static final String STREAM = "DELIVERY_RESULT";
    public static final String SUBJECT_FILTER = "machine.*.delivery.result";

    // the `delivery` block of the command, copied back by the agent as is
    private DeliveryRef delivery;
    @JsonFormat(with = JsonFormat.Feature.READ_UNKNOWN_ENUM_VALUES_AS_NULL)
    private DeliveryResult result;
    private String error;
}
