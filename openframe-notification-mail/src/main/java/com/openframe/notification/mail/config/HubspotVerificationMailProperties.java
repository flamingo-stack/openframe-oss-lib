package com.openframe.notification.mail.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.time.Duration;

/** Limits the time a verification-email send may wait for HubSpot to respond. */
@ConfigurationProperties("openframe.mail.hubspot")
public record HubspotVerificationMailProperties(@DefaultValue("20s") Duration verificationSendTimeout) {

    public HubspotVerificationMailProperties {
        if (verificationSendTimeout.isZero() || verificationSendTimeout.isNegative()) {
            throw new IllegalArgumentException("HubSpot verification send timeout must be positive");
        }
    }
}
