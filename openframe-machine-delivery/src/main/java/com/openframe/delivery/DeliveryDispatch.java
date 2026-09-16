package com.openframe.delivery;

public interface DeliveryDispatch {

    void send(DeliveryRequest<?> request);
}
