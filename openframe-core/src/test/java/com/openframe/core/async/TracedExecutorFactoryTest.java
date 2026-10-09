package com.openframe.core.async;

import io.micrometer.context.ContextRegistry;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;

import static org.assertj.core.api.Assertions.assertThat;

class TracedExecutorFactoryTest {

    private static final String ACCESSOR_KEY = "traced-executor-factory-test";
    private static final String CONTEXT_VALUE = "trace-context-of-caller";
    private static final ThreadLocal<String> CONTEXT_HOLDER = new ThreadLocal<>();
    private static final Duration TASK_TIMEOUT = Duration.ofSeconds(5);

    @BeforeEach
    void setUp() {
        ContextRegistry registry = ContextRegistry.getInstance();
        registry.registerThreadLocalAccessor(ACCESSOR_KEY, CONTEXT_HOLDER);
    }

    @AfterEach
    void tearDown() {
        ContextRegistry registry = ContextRegistry.getInstance();
        registry.removeThreadLocalAccessor(ACCESSOR_KEY);
        CONTEXT_HOLDER.remove();
    }

    @Test
    void newVirtualThreadPerTaskExecutor_callerHasThreadLocalContext_contextRestoredInsideTask() {
        // setup
        CONTEXT_HOLDER.set(CONTEXT_VALUE);
        ExecutorService executor = TracedExecutorFactory.newVirtualThreadPerTaskExecutor();
        CompletableFuture<String> contextInsideTask = new CompletableFuture<>();

        // execution
        executor.execute(() -> contextInsideTask.complete(CONTEXT_HOLDER.get()));

        // verifications
        assertThat(contextInsideTask).succeedsWithin(TASK_TIMEOUT).isEqualTo(CONTEXT_VALUE);
    }

    @Test
    void newVirtualThreadPerTaskExecutor_callerHasNoContext_taskStillRuns() {
        // setup
        ExecutorService executor = TracedExecutorFactory.newVirtualThreadPerTaskExecutor();
        CompletableFuture<Boolean> taskExecuted = new CompletableFuture<>();

        // execution
        executor.execute(() -> taskExecuted.complete(true));

        // verifications
        assertThat(taskExecuted).succeedsWithin(TASK_TIMEOUT).isEqualTo(true);
    }
}
