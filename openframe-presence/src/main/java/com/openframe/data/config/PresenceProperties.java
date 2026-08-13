package com.openframe.data.config;

import lombok.Data;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "openframe.presence")
public class PresenceProperties implements InitializingBean {

    private long ttlSeconds;

    @Override
    public void afterPropertiesSet() {
        if (ttlSeconds <= 0) {
            throw new IllegalStateException(
                    "openframe.presence.ttl-seconds must be set to a positive number of seconds — there is no default");
        }
    }
}
