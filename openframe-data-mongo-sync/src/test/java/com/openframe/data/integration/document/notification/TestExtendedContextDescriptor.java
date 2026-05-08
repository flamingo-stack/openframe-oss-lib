package com.openframe.data.integration.document.notification;

import com.openframe.data.document.notification.NotificationContext;
import com.openframe.data.document.notification.NotificationContextDescriptor;
import org.springframework.stereotype.Component;

@Component
public class TestExtendedContextDescriptor implements NotificationContextDescriptor {

    @Override
    public String type() {
        return TestExtendedContext.TYPE;
    }

    @Override
    public Class<? extends NotificationContext> contextClass() {
        return TestExtendedContext.class;
    }
}
