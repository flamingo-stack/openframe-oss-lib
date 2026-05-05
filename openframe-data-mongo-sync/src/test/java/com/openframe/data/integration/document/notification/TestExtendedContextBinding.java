package com.openframe.data.integration.document.notification;

import com.openframe.data.document.notification.NotificationContext;
import com.openframe.data.document.notification.NotificationContextBinding;
import org.springframework.stereotype.Component;

/** Test binding for {@link TestExtendedContext}. */
@Component
public class TestExtendedContextBinding implements NotificationContextBinding {

    @Override
    public String type() {
        return TestExtendedContext.TYPE;
    }

    @Override
    public Class<? extends NotificationContext> contextClass() {
        return TestExtendedContext.class;
    }
}
