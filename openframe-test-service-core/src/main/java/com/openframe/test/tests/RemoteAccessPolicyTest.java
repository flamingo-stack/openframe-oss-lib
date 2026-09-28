package com.openframe.test.tests;

import com.openframe.test.api.RemoteAccessPolicyApi;
import com.openframe.test.context.PipelineContext;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pipeline-scoped remote-access mode.
 *
 * <p>A remote session's mode resolves device → organization → tenant → code default, and both
 * {@code APPROVAL_REQUIRED} (the code default) and {@code NOTIFY_ONLY} park the session until the end
 * user accepts on the device — {@code RemoteSessionService} gates on exactly those two. Nobody is at
 * the keyboard of the test box, so {@code DeviceRemoteTest} hung on that gate and failed with "the
 * remote-access approval gate is waiting for the end user" — the qa nightly of 2026-09-25 among them.
 *
 * <p>A pipeline run registers its own tenant, so it starts with no policy document at any scope and
 * lands on the code default. A long-lived tenant may sit anywhere; qa's {@code test-env} was at
 * {@code NOTIFY_ONLY} when this was written. Both gate, which is why the setup sets the mode outright
 * rather than checking whether it needs to.
 *
 * <p>Modelled on {@link AdminFixtureTest}: a setup phase the pipeline runs before the phase that needs
 * it, and a teardown phase at the very end, so the mode is changed once per run rather than per class
 * and the tenant is left as it was found. The previous mode travels between them in
 * {@link PipelineContext}.
 *
 * <p>Tenant scope, not device: that is the scope this suite owns. A device or organization override
 * still wins and would have to be cleared separately.
 */
@Tag("oss")
@DisplayName("Remote access policy")
@Slf4j
public class RemoteAccessPolicyTest extends BaseTest {

    @Tag("remote-access-setup")
    @Test
    @DisplayName("Allow remote sessions to open without an approval step")
    public void allowSilentRemoteAccess() {
        String previous = RemoteAccessPolicyApi.setTenantMode(RemoteAccessPolicyApi.SILENT_ACCESS);
        PipelineContext.setPreviousRemoteAccessMode(previous);

        assertThat(RemoteAccessPolicyApi.getTenantMode())
                .as("The tenant should now open remote sessions silently")
                .isEqualTo(RemoteAccessPolicyApi.SILENT_ACCESS);
    }

    @Tag("remote-access-teardown")
    @Test
    @DisplayName("Restore the tenant remote-access mode")
    public void restoreRemoteAccessMode() {
        String previous = PipelineContext.getPreviousRemoteAccessMode();
        if (previous == null || RemoteAccessPolicyApi.SILENT_ACCESS.equals(previous)) {
            log.info("Nothing to restore: the tenant was already at {}", previous);
            return;
        }
        RemoteAccessPolicyApi.setTenantMode(previous);

        assertThat(RemoteAccessPolicyApi.getTenantMode())
                .as("The tenant should be left as the run found it")
                .isEqualTo(previous);
    }
}
