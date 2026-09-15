package com.openframe.client.metrics;

import com.openframe.data.document.rmm.delivery.DeliveryFailure;
import com.openframe.data.document.rmm.delivery.DeliveryKind;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Locale;

@Component
@RequiredArgsConstructor
public class DeliveryMetrics {

    private static final String RETRIED_COUNTER = "openframe.rmm.delivery.retried";
    private static final String FAILED_COUNTER = "openframe.rmm.delivery.failed";
    private static final String TAG_KIND = "kind";
    private static final String TAG_REASON = "reason";

    private final MeterRegistry meterRegistry;

    public void recordRetried(DeliveryKind kind) {
        String kindTag = tagValue(kind.name());
        meterRegistry.counter(RETRIED_COUNTER, TAG_KIND, kindTag).increment();
    }

    public void recordFailed(DeliveryKind kind, DeliveryFailure failure) {
        String kindTag = tagValue(kind.name());
        String reasonTag = tagValue(failure.name());
        meterRegistry.counter(FAILED_COUNTER, TAG_KIND, kindTag, TAG_REASON, reasonTag).increment();
    }

    private static String tagValue(String enumName) {
        return enumName.toLowerCase(Locale.ROOT);
    }
}
