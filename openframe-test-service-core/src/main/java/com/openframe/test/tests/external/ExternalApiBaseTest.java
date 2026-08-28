package com.openframe.test.tests.external;

import com.openframe.test.api.external.ExternalOrganizationApi;
import com.openframe.test.config.ExternalApiConfig;
import com.openframe.test.data.dto.external.organization.OrganizationResponse;
import com.openframe.test.tests.BaseTest;
import lombok.extern.slf4j.Slf4j;

import java.util.ArrayList;
import java.util.List;

/**
 * Shared setup for the External API suite — the {@code /external-api/**} surface authenticated by an
 * {@code X-API-Key} rather than the admin OAuth session the rest of the suite uses.
 *
 * <p>Gated on a configured key: with {@code TEST_EXTERNAL_API_KEY} unset these cases report as skipped
 * rather than failing every assertion on a missing credential, so a run without the secret is still a
 * meaningful run. The gate is {@code @EnabledIf(EXTERNAL_API_KEY_CONDITION)}, which every concrete
 * subclass must carry itself — JUnit's {@code @EnabledIf} is not {@code @Inherited}, so declaring it
 * here would silently do nothing.
 *
 * <p>The suite runs against a shared QA tenant, so it holds itself to two rules:
 * <ul>
 *   <li>never mutate a record it did not create (the one exception is the device nickname round-trip,
 *       which restores the original value);</li>
 *   <li>clean up everything it did create, via {@link #trackOrganization}.</li>
 * </ul>
 */
@Slf4j
public abstract class ExternalApiBaseTest extends BaseTest {

    /** Condition every concrete External API test class gates on; see the class javadoc for why it is not here. */
    protected static final String EXTERNAL_API_KEY_CONDITION = "com.openframe.test.config.ExternalApiConfig#hasApiKey";

    protected static final String STATUS_ACTIVE = "ACTIVE";
    protected static final String STATUS_ARCHIVED = "ARCHIVED";

    /** Business {@code organizationId}s, which is what the mutation routes take — not the Mongo {@code id}. */
    private static final List<String> createdOrganizationIds = new ArrayList<>();

    /**
     * Registers an organization for archival at the end of the class.
     *
     * <p>Archive is the strongest cleanup the External API offers — there is no delete — but it is
     * reversible and takes the row out of the default {@code status=ACTIVE} listing, which is what the
     * other cases assert against.
     */
    protected static OrganizationResponse trackOrganization(OrganizationResponse organization) {
        createdOrganizationIds.add(organization.getOrganizationId());
        return organization;
    }

    /**
     * Archives every organization this class created. Best-effort per record: one failure must not
     * strand the rest, and a cleanup failure must not mask the real test result.
     */
    protected static void archiveTrackedOrganizations() {
        for (String organizationId : createdOrganizationIds) {
            try {
                ExternalOrganizationApi.updateStatus(organizationId, STATUS_ARCHIVED);
                log.info("Cleaned up organization {}", organizationId);
            } catch (Exception e) {
                log.warn("Could not archive organization {} during teardown: {}",
                        organizationId, e.getMessage());
            }
        }
        createdOrganizationIds.clear();
    }

    /** Logged once per class so a failing run records which key it ran as, without leaking the secret. */
    protected static void logActor() {
        log.info("External API suite running as key {}", ExternalApiConfig.maskedKey());
    }
}
