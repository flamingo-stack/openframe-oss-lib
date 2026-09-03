package com.openframe.notification.mail.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.Assert;
import org.springframework.util.StringUtils;

@Component
public class MailProviderConfigCheck {

    public MailProviderConfigCheck(@Value("${openframe.mail.provider:smtp}") String provider,
                                   @Value("${openframe.mail.test-signup-provider:}") String testSignupProvider) {
        Assert.state("smtp".equalsIgnoreCase(provider) || "hubspot-api".equalsIgnoreCase(provider),
                "openframe.mail.provider must be smtp or hubspot-api: " + provider);
        Assert.state(!StringUtils.hasText(testSignupProvider) || "smtp".equalsIgnoreCase(testSignupProvider),
                "openframe.mail.test-signup-provider must be unset or smtp: " + testSignupProvider);
    }
}
