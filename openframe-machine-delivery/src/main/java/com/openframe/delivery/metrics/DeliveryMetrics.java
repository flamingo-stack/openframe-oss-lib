package com.openframe.delivery.metrics;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryType;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.Locale;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.delivery.enabled", havingValue = "true")
public class DeliveryMetrics {

    private static final String RETRIED_COUNTER = "openframe.delivery.retried";
    private static final String FAILED_COUNTER = "openframe.delivery.failed";
    private static final String PUBLISH_FAILED_COUNTER = "openframe.delivery.publish_failed";
    private static final String SWEEP_TIMER = "openframe.delivery.sweep.duration";
    private static final String TAG_TYPE = "type";
    private static final String TAG_REASON = "reason";
    private static final String TAG_PASS = "pass";
    private static final String TAG_OUTCOME = "outcome";
    private static final String OUTCOME_OK = "ok";
    private static final String OUTCOME_ERROR = "error";

    private final MeterRegistry meterRegistry;

    public void recordRetried(DeliveryType type) {
        String typeTag = tagValue(type.name());
        meterRegistry.counter(RETRIED_COUNTER, TAG_TYPE, typeTag).increment();
    }

    public void recordFailed(DeliveryType type, DeliveryFailure failure) {
        String typeTag = tagValue(type.name());
        String reasonTag = tagValue(failure.name());
        meterRegistry.counter(FAILED_COUNTER, TAG_TYPE, typeTag, TAG_REASON, reasonTag).increment();
    }

    public void recordPublishFailed(DeliveryType type) {
        String typeTag = tagValue(type.name());
        meterRegistry.counter(PUBLISH_FAILED_COUNTER, TAG_TYPE, typeTag).increment();
    }

    public void timeSweepPass(String pass, Runnable body) {
        Timer.Sample sample = Timer.start(meterRegistry);
        String outcome = OUTCOME_OK;
        try {
            body.run();
        } catch (RuntimeException e) {
            outcome = OUTCOME_ERROR;
            throw e;
        } finally {
            Timer timer = meterRegistry.timer(SWEEP_TIMER, TAG_PASS, pass, TAG_OUTCOME, outcome);
            sample.stop(timer);
        }
    }

    private static String tagValue(String enumName) {
        return enumName.toLowerCase(Locale.ROOT);
    }
}
