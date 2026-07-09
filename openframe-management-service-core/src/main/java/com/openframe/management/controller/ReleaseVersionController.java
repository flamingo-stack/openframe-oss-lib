package com.openframe.management.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * @deprecated No-op kept only so the existing cluster-registration devops job keeps getting a 2xx
 * while it is migrated off this endpoint. The openframe-client version is now set at startup by
 * {@link com.openframe.management.initializer.OpenFrameClientVersionInitializer} from
 * {@code openframe.client-versions.client}, so this endpoint no longer does anything.
 * DELETE THIS ENDPOINT (and the devops job that calls it) BY 2026-07-11.
 */
@Deprecated(forRemoval = true)
@Slf4j
@RestController
@RequestMapping("/v1/cluster-registrations")
public class ReleaseVersionController {

    @PostMapping
    public void updateReleaseVersion(@RequestBody(required = false) String request) {
        // No-op: retained temporarily for backward compatibility with the cluster-registration job.
        // TODO: remove by 2026-07-11 together with the caller.
        log.warn("Deprecated no-op endpoint POST /v1/cluster-registrations was called; "
                + "openframe-client version is now initialized at startup. Remove the caller and this endpoint by 2026-07-11.");
    }
}
