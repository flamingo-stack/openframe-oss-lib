package com.openframe.delivery.metrics;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryType;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Tags;
import io.micrometer.core.instrument.Timer;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Component
@RequiredArgsConstructor
public class DeliveryMetrics {

    private static final String RETRIED_COUNTER = "openframe.delivery.retried";
    private static final String FAILED_COUNTER = "openframe.delivery.failed";
    private static final String RERUN_COUNTER = "openframe.delivery.rerun";
    private static final String PUBLISH_FAILED_COUNTER = "openframe.delivery.publish_failed";
    private static final String ROW_ERROR_COUNTER = "openframe.delivery.sweep.row_errors";
    private static final String RESULT_REJECTED_COUNTER = "openframe.delivery.result.rejected";
    private static final String DISPATCHED_COUNTER = "openframe.delivery.dispatch.sent";
    private static final String DISPATCH_FAILED_COUNTER = "openframe.delivery.dispatch.failed";
    private static final String DISPATCH_DUPLICATE_COUNTER = "openframe.delivery.dispatch.duplicate";
    private static final String DISPATCH_REJECTED_COUNTER = "openframe.delivery.dispatch.rejected";
    private static final String DISPATCH_RECEIVED_COUNTER = "openframe.delivery.dispatch.received";
    private static final String DISPATCH_HELD_COUNTER = "openframe.delivery.dispatch.held";
    private static final String SWEEP_TIMER = "openframe.delivery.sweep.duration";
    private static final String ROLLOUT_BATCH_FAILED_COUNTER = "openframe.delivery.rollout.batch_failed";
    private static final String ROLLOUT_MACHINE_SKIPPED_COUNTER = "openframe.delivery.rollout.machine_skipped";
    private static final String ROLLOUT_STARTED_COUNTER = "openframe.delivery.rollout.started";
    private static final String ROLLOUT_FINISHED_COUNTER = "openframe.delivery.rollout.finished";
    private static final String ROLLOUT_MACHINES_COUNTER = "openframe.delivery.rollout.machines";
    private static final String ROLLOUT_DURATION_TIMER = "openframe.delivery.rollout.duration";
    private static final String ROLLOUT_RUNNING_GAUGE = "openframe.delivery.rollout.running";
    private static final String TAG_TYPE = "type";
    private static final String TAG_REASON = "reason";
    private static final String TAG_SINK = "sink";
    private static final String TAG_PASS = "pass";
    private static final String TAG_OUTCOME = "outcome";
    private static final String OUTCOME_OK = "ok";
    private static final String OUTCOME_ERROR = "error";

    private final MeterRegistry meterRegistry;
    // a gauge keeps only a weak reference to its number; the map keeps the numbers alive
    private final Map<DeliveryType, AtomicInteger> rolloutsRunning = new ConcurrentHashMap<>();

    public void recordRetried(DeliveryType type) {
        String typeTag = tagValue(type.name());
        meterRegistry.counter(RETRIED_COUNTER, TAG_TYPE, typeTag).increment();
    }

    public void recordFailed(DeliveryType type, DeliveryFailure failure) {
        String typeTag = tagValue(type.name());
        String reasonTag = tagValue(failure.name());
        meterRegistry.counter(FAILED_COUNTER, TAG_TYPE, typeTag, TAG_REASON, reasonTag).increment();
    }

    public void recordRerun(DeliveryType type, DeliveryFailure failure) {
        String typeTag = tagValue(type.name());
        String reasonTag = tagValue(failure.name());
        meterRegistry.counter(RERUN_COUNTER, TAG_TYPE, typeTag, TAG_REASON, reasonTag).increment();
    }

    public void recordDispatched(DeliveryType type, String sink) {
        String typeTag = tagValue(type.name());
        meterRegistry.counter(DISPATCHED_COUNTER, TAG_TYPE, typeTag, TAG_SINK, sink).increment();
    }

    public void recordDispatchFailed(DeliveryType type) {
        String typeTag = tagValue(type.name());
        meterRegistry.counter(DISPATCH_FAILED_COUNTER, TAG_TYPE, typeTag).increment();
    }

    public void recordDispatchDuplicate(DeliveryType type) {
        String typeTag = tagValue(type.name());
        meterRegistry.counter(DISPATCH_DUPLICATE_COUNTER, TAG_TYPE, typeTag).increment();
    }

    // recorded for a machine that is not online, nothing published: the sweep sends it when the machine shows up
    public void recordDispatchHeld(DeliveryType type) {
        String typeTag = tagValue(type.name());
        meterRegistry.counter(DISPATCH_HELD_COUNTER, TAG_TYPE, typeTag).increment();
    }

    // every record the hand-off consumer took off the topic, before it is read: the one sign the consumer is alive
    public void recordDispatchReceived() {
        meterRegistry.counter(DISPATCH_RECEIVED_COUNTER).increment();
    }

    public void recordDispatchRejected(String reason) {
        meterRegistry.counter(DISPATCH_REJECTED_COUNTER, TAG_REASON, reason).increment();
    }

    public void recordResultRejected(String reason) {
        meterRegistry.counter(RESULT_REJECTED_COUNTER, TAG_REASON, reason).increment();
    }

    public void recordPublishFailed(DeliveryType type) {
        String typeTag = tagValue(type.name());
        meterRegistry.counter(PUBLISH_FAILED_COUNTER, TAG_TYPE, typeTag).increment();
    }

    public void recordRowError() {
        meterRegistry.counter(ROW_ERROR_COUNTER).increment();
    }

    public void recordRolloutBatchFailed(DeliveryType type) {
        String typeTag = tagValue(type.name());
        meterRegistry.counter(ROLLOUT_BATCH_FAILED_COUNTER, TAG_TYPE, typeTag).increment();
    }

    public void recordRolloutMachineSkipped(DeliveryType type) {
        String typeTag = tagValue(type.name());
        meterRegistry.counter(ROLLOUT_MACHINE_SKIPPED_COUNTER, TAG_TYPE, typeTag).increment();
    }

    public void recordRolloutStarted(DeliveryType type) {
        String typeTag = tagValue(type.name());
        meterRegistry.counter(ROLLOUT_STARTED_COUNTER, TAG_TYPE, typeTag).increment();
    }

    public void recordRolloutMachines(DeliveryType type, int machines) {
        String typeTag = tagValue(type.name());
        meterRegistry.counter(ROLLOUT_MACHINES_COUNTER, TAG_TYPE, typeTag).increment(machines);
    }

    public void recordRolloutFinished(DeliveryType type, Duration took) {
        String typeTag = tagValue(type.name());
        meterRegistry.counter(ROLLOUT_FINISHED_COUNTER, TAG_TYPE, typeTag).increment();
        meterRegistry.timer(ROLLOUT_DURATION_TIMER, TAG_TYPE, typeTag).record(took);
    }

    // set on every rollout pass for every type, so a type with nothing running reads 0 rather than a stale value
    public void recordRolloutsRunning(DeliveryType type, int count) {
        AtomicInteger running = rolloutsRunning.computeIfAbsent(type, this::registerRolloutsRunning);
        running.set(count);
    }

    private AtomicInteger registerRolloutsRunning(DeliveryType type) {
        String typeTag = tagValue(type.name());
        Tags tags = Tags.of(TAG_TYPE, typeTag);
        return meterRegistry.gauge(ROLLOUT_RUNNING_GAUGE, tags, new AtomicInteger());
    }

    public void timeSweepPass(String pass, Runnable body) {
        Timer.Sample sample = Timer.start(meterRegistry);
        String outcome = OUTCOME_ERROR;
        try {
            body.run();
            outcome = OUTCOME_OK;
        } finally {
            Timer timer = meterRegistry.timer(SWEEP_TIMER, TAG_PASS, pass, TAG_OUTCOME, outcome);
            sample.stop(timer);
        }
    }

    private static String tagValue(String enumName) {
        return enumName.toLowerCase(Locale.ROOT);
    }
}
