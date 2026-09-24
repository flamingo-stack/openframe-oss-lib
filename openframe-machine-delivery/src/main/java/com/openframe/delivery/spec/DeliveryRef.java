package com.openframe.delivery.spec;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.openframe.data.document.delivery.DeliveryType;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DeliveryRef {

    // a type this server does not know yet reads as null and the report is rejected instead of poisoning the consumer
    @JsonFormat(with = JsonFormat.Feature.READ_UNKNOWN_ENUM_VALUES_AS_NULL)
    private DeliveryType type;
    private String targetId;
    private String dispatchId;
}
