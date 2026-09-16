package com.openframe.data.nats.delivery;

public interface DeliveryDispatch {

    void send(DeliveryRequest request, Runnable publish);
}
