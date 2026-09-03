package com.openframe.test.tests.external;

import com.openframe.test.api.external.ExternalCustomerApi;
import com.openframe.test.config.ExternalApiConfig;
import com.openframe.test.data.dto.external.customer.CustomerResponse;
import com.openframe.test.helpers.ExternalApiKeyExtension;
import com.openframe.test.tests.BaseTest;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.extension.ExtendWith;

import java.util.ArrayList;
import java.util.List;

/**
 * Shared setup for the External API suite — the {@code /external-api/**} surface authenticated by an
 * {@code X-API-Key} rather than the admin OAuth session the rest of the suite uses.
 *
 * <p><b>The suite provisions its own credential.</b> On first use it mints a key over
 * {@code POST /api/api-keys} as the ADMIN session, and {@link ExternalApiKeyExtension} deletes it again
 * when the run ends, so no secret has to be set up out of band. A key supplied explicitly — by the
 * runner service, or in {@code TEST_EXTERNAL_API_KEY} — is used as-is and never deleted.
 *
 * <p>Gated on being able to obtain a key at all: with no credentials configured these cases report as
 * skipped rather than failing every assertion, so a partly-configured run is still a meaningful run.
 * The gate is {@code @EnabledIf(EXTERNAL_API_KEY_CONDITION)}, which every concrete subclass must carry
 * itself — JUnit's {@code @EnabledIf} is not {@code @Inherited}, so declaring it here would silently do
 * nothing. {@code @ExtendWith} is, which is why the cleanup extension can live on this class alone.
 *
 * <p>The suite runs against a shared QA tenant, so it holds itself to two rules:
 * <ul>
 *   <li>never mutate a record it did not create (the one exception is the device nickname round-trip,
 *       which restores the original value);</li>
 *   <li>clean up everything it did create, via {@link #trackCustomer}.</li>
 * </ul>
 */
@Slf4j
@ExtendWith(ExternalApiKeyExtension.class)
public abstract class ExternalApiBaseTest extends BaseTest {

    /** Condition every concrete External API test class gates on; see the class javadoc for why it is not here. */
    protected static final String EXTERNAL_API_KEY_CONDITION = "com.openframe.test.config.ExternalApiConfig#canObtainApiKey";

    protected static final String STATUS_ACTIVE = "ACTIVE";
    protected static final String STATUS_ARCHIVED = "ARCHIVED";

    private static final List<String> createdCustomerIds = new ArrayList<>();

    /**
     * Registers a customer for archival at the end of the class.
     *
     * <p>Archive is the strongest cleanup the External API offers — there is no delete — but it is
     * reversible and takes the row out of the default {@code status=ACTIVE} listing, which is what the
     * other cases assert against.
     */
    protected static CustomerResponse trackCustomer(CustomerResponse customer) {
        createdCustomerIds.add(customer.getId());
        return customer;
    }

    /**
     * Archives every customer this class created. Best-effort per record: one failure must not strand
     * the rest, and a cleanup failure must not mask the real test result.
     */
    protected static void archiveTrackedCustomers() {
        for (String customerId : createdCustomerIds) {
            try {
                ExternalCustomerApi.updateStatus(customerId, STATUS_ARCHIVED);
                log.info("Cleaned up customer {}", customerId);
            } catch (Exception e) {
                log.warn("Could not archive customer {} during teardown: {}", customerId, e.getMessage());
            }
        }
        createdCustomerIds.clear();
    }

    /**
     * Logged once per class so a failing run records which key it ran as, without leaking the secret.
     *
     * <p>Obtaining the key first is deliberate rather than incidental: it makes the first class's
     * {@code @BeforeAll} the point at which the run's key is minted, so the mint is logged before any
     * assertion rather than in the middle of whichever case happened to issue the first request.
     */
    protected static void logActor() {
        ExternalApiConfig.getApiKey();
        log.info("External API suite running as key {}", ExternalApiConfig.maskedKey());
    }
}
