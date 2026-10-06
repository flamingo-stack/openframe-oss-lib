package com.openframe.delivery.spec;

import lombok.Data;

@Data
public class TestPayload implements DeliveryPayload {

    private DeliveryRef delivery;
    private String value;
}
