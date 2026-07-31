package com.openframe.data.nats.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

@Configuration
public class NotificationChannelExecutorConfig {

    public static final String CHANNEL_EXECUTOR = "notificationChannelExecutor";

    /** Lib-owned so @Async does not fall back to unbounded platform threads in a consumer with no default executor. */
    @Bean(CHANNEL_EXECUTOR)
    public Executor notificationChannelExecutor() {
        return Executors.newVirtualThreadPerTaskExecutor();
    }
}
