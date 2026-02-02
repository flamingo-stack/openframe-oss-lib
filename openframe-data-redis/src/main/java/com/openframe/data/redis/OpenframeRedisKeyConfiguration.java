package com.openframe.data.redis;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableConfigurationProperties(OpenframeRedisProperties.class)
public class OpenframeRedisKeyConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public OpenframeRedisKeyBuilder openframeRedisKeyBuilder(OpenframeRedisProperties props) {
        return new OpenframeRedisKeyBuilder(props);
    }
}

