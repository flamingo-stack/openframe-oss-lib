package com.openframe.test.tests;

import com.openframe.test.context.PipelineContext;
import com.openframe.test.data.dto.device.DeviceFilterInput;
import com.openframe.test.helpers.AuthHelper;
import org.junit.jupiter.api.BeforeAll;

import static com.openframe.test.data.generator.DeviceGenerator.inOrganization;

public abstract class BaseTest {

    @BeforeAll
    public static void setup() {
        AuthHelper.clearCookies();
    }

    /**
     * Narrows a device filter to the organization this pipeline created, when there is one.
     *
     * <p>Status-only filters span the whole tenant. On the single-device fixture tenant a pipeline
     * registers that is the same set either way — which is why the unscoped form went unnoticed for so
     * long. On a shared tenant it is not: the archive cases selected an unrelated OFFLINE device out of
     * a long-lived QA tenant, archived and deleted it, and left the pipeline's own device attached to
     * the org it was about to archive, which then failed with a 409.
     *
     * <p>Use it wherever a case <em>acts</em> on the device it selects — mutating the device, or
     * creating records against that device's organization. A read-only assertion about the tenant at
     * large should not be scoped.
     *
     * <p>Outside a pipeline there is no org and the filter is returned unchanged, preserving the
     * historical behaviour for standalone runs.
     */
    protected static DeviceFilterInput pipelineScoped(DeviceFilterInput filter) {
        String orgId = PipelineContext.getOrgId();
        return orgId == null || orgId.isBlank() ? filter : inOrganization(filter, orgId);
    }

    /** Names the scope a selection ran against, so a failure says which set was searched. */
    protected static String orgSuffix() {
        String orgId = PipelineContext.getOrgId();
        return orgId == null || orgId.isBlank() ? " (tenant-wide: no pipeline org set)" : " in org " + orgId;
    }
}
