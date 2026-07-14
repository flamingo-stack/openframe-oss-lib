package com.openframe.notification.push;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "openframe.push.fcm")
public class FcmProperties {

    /**
     * Firebase project the pushes are sent from — differs per environment (dev/stage/prod each have
     * their own Firebase project, because a token issued for one project is meaningless to another).
     * Required: user-scoped Application Default Credentials carry no project, so it cannot be inferred.
     */
    private String projectId;

    /**
     * Cap on the serialized NotificationContext carried in the data payload. FCM rejects messages over
     * ~4KB, and a fat context (an approval with many tool calls) can get there — beyond this we drop the
     * context rather than lose the whole push; the client still has the id and can fetch the rest.
     */
    private int maxContextBytes = 2500;
}
