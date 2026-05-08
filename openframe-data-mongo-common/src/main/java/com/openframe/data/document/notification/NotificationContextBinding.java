package com.openframe.data.document.notification;

public interface NotificationContextBinding {

    String type();

    Class<? extends NotificationContext> contextClass();
}
