package com.openframe.delivery.sweep;

public class DeliveryPublishException extends RuntimeException {

    public DeliveryPublishException(String deliveryId, RuntimeException cause) {
        super("Publish failed for delivery " + deliveryId, cause);
    }
}
