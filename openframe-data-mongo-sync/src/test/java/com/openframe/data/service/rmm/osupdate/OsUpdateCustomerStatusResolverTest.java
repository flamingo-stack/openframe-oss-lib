package com.openframe.data.service.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateClassification;
import com.openframe.data.document.rmm.osupdate.OsUpdateCustomerStatus;
import com.openframe.data.document.rmm.osupdate.OsUpdateOverride;
import com.openframe.data.document.rmm.osupdate.OsUpdateOverrideAction;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicy;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicyTarget;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicyTargetType;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutMode;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutRule;
import com.openframe.data.document.rmm.osupdate.OsUpdateUrgency;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.Instant;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class OsUpdateCustomerStatusResolverTest {

    private static final Instant PUBLISHED_AT = Instant.parse("2026-10-13T17:00:00Z");
    private static final Instant CREATED_AT = Instant.parse("2026-10-01T00:00:00Z");
    private static final String ORGANIZATION_ID = "org-1";

    private OsUpdateCustomerStatusResolver osUpdateCustomerStatusResolver;
    private OsUpdatePolicy tenantPolicy;
    private OsUpdate qualityOsUpdate;

    @BeforeEach
    void setUp() {
        osUpdateCustomerStatusResolver = new OsUpdateCustomerStatusResolver(
                new OsUpdatePolicyResolver(), new OsUpdateOverrideResolver(), new OsUpdateUrgencyResolver(),
                new OsUpdateRolloutStrategyResolver(List.of(new PilotThenEveryoneRolloutStrategy(),
                        new EveryoneAtOnceRolloutStrategy(), new HoldRolloutStrategy())),
                new OsUpdateReleasedAtResolver());
        Map<OsUpdateUrgency, OsUpdateRolloutRule> rolloutRules = new EnumMap<>(OsUpdateUrgency.class);
        rolloutRules.put(OsUpdateUrgency.QUALITY, OsUpdateRolloutRule.builder()
                .mode(OsUpdateRolloutMode.PILOT_THEN_EVERYONE).daysAfterRelease(3).daysLaterToEveryone(4).build());
        tenantPolicy = OsUpdatePolicy.builder()
                .id("policy-tenant")
                .target(OsUpdatePolicyTarget.builder().type(OsUpdatePolicyTargetType.TENANT).build())
                .rolloutRules(rolloutRules)
                .createdAt(CREATED_AT)
                .build();
        qualityOsUpdate = OsUpdate.builder()
                .identifier("update-1")
                .classification(OsUpdateClassification.QUALITY)
                .publishedAt(PUBLISHED_AT)
                .build();
    }

    @ParameterizedTest
    @CsvSource({
            "2026-10-16T16:59:59Z, SCHEDULED",
            "2026-10-16T17:00:00Z, PILOT",
            "2026-10-20T16:59:59Z, PILOT",
            "2026-10-20T17:00:00Z, APPROVED"})
    void resolve_pilotRuleWithoutADecision_followsTheDayOfThePilotRingAndTheDayOfEveryone(
            Instant now, OsUpdateCustomerStatus expectedStatus) {
        // execution
        OsUpdateCustomerRollout resolved = osUpdateCustomerStatusResolver.resolve(
                List.of(tenantPolicy), List.of(), qualityOsUpdate, ORGANIZATION_ID, now);

        // verifications
        assertThat(resolved.getOsUpdateCustomerStatus()).isEqualTo(expectedStatus);
        assertThat(resolved.getOsUpdatePolicy()).isSameAs(tenantPolicy);
        assertThat(resolved.getOsUpdateUrgency()).isEqualTo(OsUpdateUrgency.QUALITY);
        assertThat(resolved.getOsUpdateRolloutRule())
                .isSameAs(tenantPolicy.getRolloutRules().get(OsUpdateUrgency.QUALITY));
        assertThat(resolved.getOsUpdateOverride()).isNull();
    }

    @ParameterizedTest
    @CsvSource({
            "2026-10-16T16:59:59Z, SCHEDULED",
            "2026-10-16T17:00:00Z, APPROVED"})
    void resolve_everyoneAtOnceRule_scheduledUntilItsDayThenApprovedAndNeverPilot(
            Instant now, OsUpdateCustomerStatus expectedStatus) {
        // setup
        tenantPolicy.getRolloutRules().put(OsUpdateUrgency.QUALITY, OsUpdateRolloutRule.builder()
                .mode(OsUpdateRolloutMode.EVERYONE_AT_ONCE).daysAfterRelease(3).build());

        // execution
        OsUpdateCustomerRollout resolved = osUpdateCustomerStatusResolver.resolve(
                List.of(tenantPolicy), List.of(), qualityOsUpdate, ORGANIZATION_ID, now);

        // verifications
        assertThat(resolved.getOsUpdateCustomerStatus()).isEqualTo(expectedStatus);
    }

    @Test
    void resolve_pilotRuleThatGivesEveryoneTheDayOfThePilotRing_approvedOnThatDayNotPilot() {
        // setup
        tenantPolicy.getRolloutRules().put(OsUpdateUrgency.QUALITY, OsUpdateRolloutRule.builder()
                .mode(OsUpdateRolloutMode.PILOT_THEN_EVERYONE).daysAfterRelease(3).daysLaterToEveryone(0).build());

        // execution
        OsUpdateCustomerRollout resolved = osUpdateCustomerStatusResolver.resolve(
                List.of(tenantPolicy), List.of(), qualityOsUpdate, ORGANIZATION_ID,
                Instant.parse("2026-10-16T17:00:00Z"));

        // verifications
        assertThat(resolved.getOsUpdateCustomerStatus()).isEqualTo(OsUpdateCustomerStatus.APPROVED);
    }

    @Test
    void resolve_holdRuleWithoutADecision_held() {
        // setup
        tenantPolicy.getRolloutRules().put(OsUpdateUrgency.QUALITY,
                OsUpdateRolloutRule.builder().mode(OsUpdateRolloutMode.HOLD).build());

        // execution
        OsUpdateCustomerRollout resolved = osUpdateCustomerStatusResolver.resolve(
                List.of(tenantPolicy), List.of(), qualityOsUpdate, ORGANIZATION_ID, PUBLISHED_AT.plusSeconds(1));

        // verifications
        assertThat(resolved.getOsUpdateCustomerStatus()).isEqualTo(OsUpdateCustomerStatus.HELD);
    }

    @ParameterizedTest
    @CsvSource({"APPROVE, APPROVED", "HOLD, HELD", "REJECT, REJECTED"})
    void resolve_decisionForTheCustomer_winsOverTheDaysOfThePolicy(OsUpdateOverrideAction action,
                                                                    OsUpdateCustomerStatus expectedStatus) {
        // setup
        OsUpdateOverride ofCustomer = OsUpdateOverride.builder().organizationId(ORGANIZATION_ID).action(action).build();

        // execution
        OsUpdateCustomerRollout resolved = osUpdateCustomerStatusResolver.resolve(
                List.of(tenantPolicy), List.of(ofCustomer), qualityOsUpdate, ORGANIZATION_ID,
                PUBLISHED_AT.plusSeconds(1));

        // verifications
        assertThat(resolved.getOsUpdateCustomerStatus()).isEqualTo(expectedStatus);
        assertThat(resolved.getOsUpdateOverride()).isSameAs(ofCustomer);
    }

    @Test
    void resolve_decisionsForEveryCustomerAndForTheCustomer_theOneOfTheCustomer() {
        // setup
        OsUpdateOverride ofEveryCustomer = OsUpdateOverride.builder().action(OsUpdateOverrideAction.REJECT).build();
        OsUpdateOverride ofCustomer = OsUpdateOverride.builder()
                .organizationId(ORGANIZATION_ID).action(OsUpdateOverrideAction.HOLD).build();

        // execution
        OsUpdateCustomerRollout resolved = osUpdateCustomerStatusResolver.resolve(
                List.of(tenantPolicy), List.of(ofEveryCustomer, ofCustomer), qualityOsUpdate, ORGANIZATION_ID,
                PUBLISHED_AT.plusSeconds(1));

        // verifications
        assertThat(resolved.getOsUpdateCustomerStatus()).isEqualTo(OsUpdateCustomerStatus.HELD);
    }

    @Test
    void resolve_decisionForOneDeviceOnly_notLookedAt() {
        // setup
        OsUpdateOverride ofDevice = OsUpdateOverride.builder()
                .machineId("machine-1").action(OsUpdateOverrideAction.REJECT).build();

        // execution
        OsUpdateCustomerRollout resolved = osUpdateCustomerStatusResolver.resolve(
                List.of(tenantPolicy), List.of(ofDevice), qualityOsUpdate, ORGANIZATION_ID,
                PUBLISHED_AT.plusSeconds(1));

        // verifications
        assertThat(resolved.getOsUpdateCustomerStatus()).isEqualTo(OsUpdateCustomerStatus.SCHEDULED);
        assertThat(resolved.getOsUpdateOverride()).isNull();
    }

    @Test
    void resolve_customerWithItsOwnPolicy_followsItNotTheOneOfTheTenant() {
        // setup
        Map<OsUpdateUrgency, OsUpdateRolloutRule> rolloutRules = new EnumMap<>(OsUpdateUrgency.class);
        rolloutRules.put(OsUpdateUrgency.QUALITY, OsUpdateRolloutRule.builder().mode(OsUpdateRolloutMode.HOLD).build());
        OsUpdatePolicy customerPolicy = OsUpdatePolicy.builder()
                .id("policy-customer")
                .target(OsUpdatePolicyTarget.builder()
                        .type(OsUpdatePolicyTargetType.CUSTOMER).organizationId(ORGANIZATION_ID).build())
                .rolloutRules(rolloutRules)
                .createdAt(CREATED_AT.plusSeconds(60))
                .build();

        // execution
        OsUpdateCustomerRollout resolved = osUpdateCustomerStatusResolver.resolve(
                List.of(tenantPolicy, customerPolicy), List.of(), qualityOsUpdate, ORGANIZATION_ID,
                PUBLISHED_AT.plusSeconds(1));

        // verifications
        assertThat(resolved.getOsUpdatePolicy()).isSameAs(customerPolicy);
        assertThat(resolved.getOsUpdateCustomerStatus()).isEqualTo(OsUpdateCustomerStatus.HELD);
    }

    @Test
    void resolve_noPolicyOfTheCustomerOrTheTenant_listedOnlyWhateverWasDecided() {
        // setup
        OsUpdateOverride ofCustomer = OsUpdateOverride.builder()
                .organizationId(ORGANIZATION_ID).action(OsUpdateOverrideAction.APPROVE).build();

        // execution
        OsUpdateCustomerRollout resolved = osUpdateCustomerStatusResolver.resolve(
                List.of(), List.of(ofCustomer), qualityOsUpdate, ORGANIZATION_ID, PUBLISHED_AT);

        // verifications
        assertThat(resolved.getOsUpdateCustomerStatus()).isEqualTo(OsUpdateCustomerStatus.LISTED_ONLY);
        assertThat(resolved.getOsUpdatePolicy()).isNull();
        assertThat(resolved.getOsUpdateRolloutRule()).isNull();
    }

    @Test
    void resolve_updateWithoutAnUrgency_listedOnly() {
        // setup
        OsUpdate driver = OsUpdate.builder()
                .identifier("update-2").classification(OsUpdateClassification.DRIVER).publishedAt(PUBLISHED_AT).build();

        // execution
        OsUpdateCustomerRollout resolved = osUpdateCustomerStatusResolver.resolve(
                List.of(tenantPolicy), List.of(), driver, ORGANIZATION_ID, PUBLISHED_AT.plusSeconds(1));

        // verifications
        assertThat(resolved.getOsUpdateCustomerStatus()).isEqualTo(OsUpdateCustomerStatus.LISTED_ONLY);
        assertThat(resolved.getOsUpdatePolicy()).isSameAs(tenantPolicy);
        assertThat(resolved.getOsUpdateUrgency()).isNull();
        assertThat(resolved.getOsUpdateRolloutRule()).isNull();
    }

    @Test
    void resolve_policyWithoutARuleOfTheUrgency_listedOnly() {
        // setup
        OsUpdate security = OsUpdate.builder()
                .identifier("update-3").classification(OsUpdateClassification.SECURITY).publishedAt(PUBLISHED_AT)
                .build();

        // execution
        OsUpdateCustomerRollout resolved = osUpdateCustomerStatusResolver.resolve(
                List.of(tenantPolicy), List.of(), security, ORGANIZATION_ID, PUBLISHED_AT.plusSeconds(1));

        // verifications
        assertThat(resolved.getOsUpdateCustomerStatus()).isEqualTo(OsUpdateCustomerStatus.LISTED_ONLY);
        assertThat(resolved.getOsUpdateUrgency()).isEqualTo(OsUpdateUrgency.OTHER_SECURITY);
    }

    @Test
    void resolve_updateTheVendorDidNotDate_countsFromItsFirstReportInTheTenant() {
        // setup
        OsUpdate notDated = OsUpdate.builder()
                .identifier("update-4").classification(OsUpdateClassification.QUALITY).firstSeenAt(PUBLISHED_AT)
                .build();

        // execution
        OsUpdateCustomerRollout resolved = osUpdateCustomerStatusResolver.resolve(
                List.of(tenantPolicy), List.of(), notDated, ORGANIZATION_ID, Instant.parse("2026-10-16T17:00:00Z"));

        // verifications
        assertThat(resolved.getOsUpdateCustomerStatus()).isEqualTo(OsUpdateCustomerStatus.PILOT);
    }
}
