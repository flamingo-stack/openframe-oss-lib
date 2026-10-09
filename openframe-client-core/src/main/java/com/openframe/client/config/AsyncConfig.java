package com.openframe.client.config;

import com.openframe.core.async.TracedExecutorFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.core.task.support.TaskExecutorAdapter;
import org.springframework.scheduling.annotation.EnableAsync;

import java.util.concurrent.ExecutorService;

@Configuration
@EnableAsync
public class AsyncConfig {

    public static final String TOOL_INSTALL_EXECUTOR = "toolInstallExecutor";

    @Bean(TOOL_INSTALL_EXECUTOR)
    public AsyncTaskExecutor toolInstallExecutor() {
        ExecutorService executor = TracedExecutorFactory.newVirtualThreadPerTaskExecutor();
        return new TaskExecutorAdapter(executor);
    }
}
