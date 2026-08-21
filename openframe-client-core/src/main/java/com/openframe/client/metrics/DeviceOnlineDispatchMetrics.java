package com.openframe.client.metrics;

import com.openframe.data.document.rmm.DeviceOnlineDispatchStatus;
import com.openframe.data.repository.rmm.DeviceOnlineDispatchRepository;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicLong;

@Component
@Slf4j
public class DeviceOnlineDispatchMetrics {

    private static final String PENDING_GAUGE = "openframe.rmm.device_online.pending";
    private static final String BATCH_SIZE_GAUGE = "openframe.rmm.device_online.batch_size";

    private final DeviceOnlineDispatchRepository dispatchRepository;
    private final AtomicLong pending = new AtomicLong(0);
    private final long batchSize;

    public DeviceOnlineDispatchMetrics(DeviceOnlineDispatchRepository dispatchRepository,
                                       MeterRegistry registry,
                                       @Value("${openframe.rmm.device-online.dispatch.batch-size}") long batchSize) {
        this.dispatchRepository = dispatchRepository;
        this.batchSize = batchSize;

        Gauge.builder(PENDING_GAUGE, pending, AtomicLong::get)
                .description("DEVICE_ONLINE dispatch sentinels awaiting processing (status=NEW)")
                .register(registry);

        Gauge.builder(BATCH_SIZE_GAUGE, this, m -> m.batchSize)
                .description("Configured DEVICE_ONLINE drain batch-size (alert threshold for the pending backlog)")
                .register(registry);
    }

    @Scheduled(fixedDelayString = "${openframe.rmm.device-online.dispatch.interval}")
    void refreshPending() {
        try {
            pending.set(dispatchRepository.countByStatus(DeviceOnlineDispatchStatus.NEW));
        } catch (Exception e) {
            log.warn("Failed to refresh DEVICE_ONLINE pending gauge: {}", e.getMessage());
        }
    }
}
