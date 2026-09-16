package com.openframe.delivery;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryType;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Locale;

@Component
@RequiredArgsConstructor
public class DeliveryMetrics {

    private static final String RETRIED_COUNTER = "openframe.delivery.retried";
    private static final String FAILED_COUNTER = "openframe.delivery.failed";
    private static final String TAG_TYPE = "type";
    private static final String TAG_REASON = "reason";

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

    private static String tagValue(String enumName) {
        return enumName.toLowerCase(Locale.ROOT);
    }
}
