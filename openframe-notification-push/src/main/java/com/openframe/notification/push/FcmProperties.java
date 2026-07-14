package com.openframe.notification.push;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "openframe.push.fcm")
public class FcmProperties {

    /** Differs per environment, and must be explicit: user-scoped ADC carries no project. */
    private String projectId;

    /** FCM rejects messages over ~4KB, so a fat context is dropped rather than losing the push. */
    private int maxContextBytes = 2500;
}
