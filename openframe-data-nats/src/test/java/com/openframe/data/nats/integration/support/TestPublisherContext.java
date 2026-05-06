package com.openframe.data.nats.integration.support;

import com.openframe.data.document.notification.NotificationContext;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import lombok.experimental.SuperBuilder;

/** Test-only context used by {@code NotificationNatsPublisherIT}. */
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@ToString(callSuper = true)
public class TestPublisherContext extends NotificationContext {

    public static final String TYPE = "TEST_PUBLISHER_CONTEXT";

    private String ticketId;
    private int priority;
}
