package com.openframe.delivery.dispatch;

public interface DeliveryPublisher {

    void publish(String subject, Object payload);
}
