package com.openframe.data.document.notification;

public interface NotificationContextDescriptor {

    String type();

    Class<? extends NotificationContext> contextClass();

    default String graphqlTypeName() {
        return contextClass().getSimpleName();
    }
}
