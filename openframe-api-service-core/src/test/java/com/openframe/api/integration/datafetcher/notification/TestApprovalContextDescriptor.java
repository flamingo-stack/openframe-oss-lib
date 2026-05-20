package com.openframe.api.integration.datafetcher.notification;

import com.openframe.data.document.notification.NotificationContext;
import com.openframe.data.document.notification.NotificationContextDescriptor;
import org.springframework.stereotype.Component;

@Component
public class TestApprovalContextDescriptor implements NotificationContextDescriptor {

    public static final String TYPE = "TEST_APPROVAL_REQUEST";

    @Override
    public String type() {
        return TYPE;
    }

    @Override
    public Class<? extends NotificationContext> contextClass() {
        return TestApprovalContext.class;
    }
}
