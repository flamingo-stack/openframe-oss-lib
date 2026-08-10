package com.openframe.api.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

/**
 * Thread pool for the {@code deviceFilters} facet fan-out. The facet queries are blocking HTTP
 * calls to the Pinot broker, so {@code supplyAsync} without an executor is the wrong default:
 * on single-core tenant pods it spawns a new unpooled thread per task, and on larger hosts it
 * would block the shared {@code ForkJoinPool.commonPool()}. A dedicated pool sized for
 * concurrent round trips (not cores) gives reused, bounded threads; under saturation
 * {@link ThreadPoolExecutor.CallerRunsPolicy} degrades to running on the request thread
 * instead of rejecting.
 */
@Configuration
public class DeviceFilterExecutorConfig {

    public static final String DEVICE_FILTER_FACET_EXECUTOR = "deviceFilterFacetExecutor";

    @Bean(DEVICE_FILTER_FACET_EXECUTOR)
    public Executor deviceFilterFacetExecutor(
            @Value("${openframe.api.device-filters.facet-threads:6}") int threads,
            @Value("${openframe.api.device-filters.facet-queue-capacity:64}") int queueCapacity) {

        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(threads);
        executor.setMaxPoolSize(threads);
        executor.setQueueCapacity(queueCapacity);
        executor.setThreadNamePrefix("device-facet-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        // Idle pods keep no threads: the facets are bursty (a dashboard or filter-UI load), and
        // between bursts there is no reason to hold six parked threads in a 1Gi container.
        executor.setAllowCoreThreadTimeOut(true);
        executor.setKeepAliveSeconds(60);
        executor.initialize();
        return executor;
    }
}
