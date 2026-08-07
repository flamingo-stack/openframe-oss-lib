package com.openframe.api.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

/**
 * Thread pool for the {@code deviceFilters} facet fan-out.
 *
 * The fan-out in {@code DeviceFilterService} used {@code CompletableFuture.supplyAsync} with no
 * executor, i.e. {@link java.util.concurrent.ForkJoinPool#commonPool()}, whose parallelism is
 * {@code availableProcessors() - 1}. Tenant pods run on a 700m CPU limit, so the JVM reports ONE
 * processor ({@code system.cpu.count = 1}) and the common pool has at most one worker — the six
 * "parallel" facet queries actually ran one after another on the request thread, and the
 * {@code allOf} join was a no-op. Raising the CPU limit does not fix this: at 2 CPUs the common
 * pool's parallelism is still 1. It needs its own pool.
 *
 * The tasks are blocking HTTP calls to the Pinot broker, not CPU work, so the pool is sized for
 * concurrent round trips rather than cores — a single-core pod can hold six of these in flight
 * for the cost of six idle threads.
 *
 * Bounded queue + {@link ThreadPoolExecutor.CallerRunsPolicy}: under saturation the work runs on
 * the calling request thread, which is exactly today's behaviour, so overload degrades to "slow"
 * instead of "rejected".
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
