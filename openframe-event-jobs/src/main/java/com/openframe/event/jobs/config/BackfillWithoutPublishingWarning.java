package com.openframe.event.jobs.config;

import com.openframe.event.jobs.config.properties.EventBackfillProperties;
import com.openframe.publishing.api.PublishedAggregateType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBooleanProperty;

import java.util.Set;

// The jobs start without publishing, for reconciliation alone; run ids set then would be ignored in silence.
@Slf4j
@RequiredArgsConstructor
@ConditionalOnBooleanProperty(name = "openframe.events.publishing.enabled", havingValue = false, matchIfMissing = true)
public class BackfillWithoutPublishingWarning implements InitializingBean {

    private final EventBackfillProperties properties;

    @Override
    public void afterPropertiesSet() {
        Set<PublishedAggregateType> types = properties.getRuns().keySet();
        if (!types.isEmpty()) {
            log.warn("Backfill run ids are set for {}, but openframe.events.publishing.enabled is off: no backfill runs", types);
        }
    }
}
