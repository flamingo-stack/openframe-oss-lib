package com.openframe.notification.mail.config;

import lombok.Value;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.time.Duration;

/** Limits the time a verification-email send may wait for HubSpot to respond. */
@Value
@ConfigurationProperties("openframe.mail.hubspot")
public class HubspotVerificationMailProperties {

    Duration verificationSendTimeout;

    public HubspotVerificationMailProperties(@DefaultValue("20s") Duration verificationSendTimeout) {
        boolean invalidTimeout = verificationSendTimeout.isZero() || verificationSendTimeout.isNegative();
        if (invalidTimeout) {
            throw new IllegalArgumentException("HubSpot verification send timeout must be positive");
        }
        this.verificationSendTimeout = verificationSendTimeout;
    }
}
