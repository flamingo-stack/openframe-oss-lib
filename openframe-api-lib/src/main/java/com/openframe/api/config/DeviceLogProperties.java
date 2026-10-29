package com.openframe.api.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Tuning for device agent log queries.
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "openframe.device-logs")
public class DeviceLogProperties {

    /**
     * When {@code openframe-saas-logs-stream} started stamping the {@code bucket} stream label. Queries whose window
     * begins at or after this instant add {@code bucket} to the selector and read a sixteenth of the tenant's data;
     * earlier windows omit it, because those lines carry no bucket and a bucketed selector would match none of them.
     * <p>
     * Unset means never, which is the safe default and the whole rollout plan: deploying this reader changes no query
     * until the writer is live and this is set to a time after that deploy. Setting it too early returns empty pages
     * rather than an error, so it is the one value to get right.
     * <p>
     * Deletable, along with the unbucketed branch, once retention has expired everything written before the cutover -
     * 10 days for {@code {job="agent-logs"}} on prod, but 30 elsewhere, so use the longer clock.
     */
    private Instant bucketCutover;
}
