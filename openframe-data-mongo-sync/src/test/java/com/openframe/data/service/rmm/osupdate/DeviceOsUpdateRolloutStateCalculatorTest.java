package com.openframe.data.service.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateRolloutState;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateClassification;
import com.openframe.data.document.rmm.osupdate.OsUpdateOverride;
import com.openframe.data.document.rmm.osupdate.OsUpdateOverrideAction;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicy;
import com.openframe.data.document.rmm.osupdate.OsUpdateRestartDeadline;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutMode;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutRule;
import com.openframe.data.document.rmm.osupdate.OsUpdateSeverity;
import com.openframe.data.document.rmm.osupdate.OsUpdateUrgency;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.time.Instant;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class DeviceOsUpdateRolloutStateCalculatorTest {

    private static final Instant PUBLISHED_AT = Instant.parse("2026-10-13T17:00:00Z");
    private static final Instant DISCOVERED_AT = Instant.parse("2026-10-13T20:00:00Z");

    private DeviceOsUpdateRolloutStateCalculator deviceOsUpdateRolloutStateCalculator;
    private OsUpdatePolicy osUpdatePolicy;
    private OsUpdate osUpdate;
    private DeviceOsPendingUpdate deviceOsPendingUpdate;

    @BeforeEach
    void setUp() {
        deviceOsUpdateRolloutStateCalculator = new DeviceOsUpdateRolloutStateCalculator(
                new OsUpdateUrgencyResolver(),
                new OsUpdateRolloutStrategyResolver(List.of(new PilotThenEveryoneRolloutStrategy(),
                        new EveryoneAtOnceRolloutStrategy(), new HoldRolloutStrategy())),
                new OsUpdateRestartDeadlineCalculator());
        Map<OsUpdateUrgency, OsUpdateRolloutRule> rolloutRules = new EnumMap<>(OsUpdateUrgency.class);
        rolloutRules.put(OsUpdateUrgency.CRITICAL_SECURITY, OsUpdateRolloutRule.builder()
                .mode(OsUpdateRolloutMode.PILOT_THEN_EVERYONE).daysAfterRelease(1).daysLaterToEveryone(3).build());
        rolloutRules.put(OsUpdateUrgency.QUALITY, OsUpdateRolloutRule.builder()
                .mode(OsUpdateRolloutMode.HOLD).build());
        Map<OsUpdateUrgency, OsUpdateRestartDeadline> restartDeadlines = new EnumMap<>(OsUpdateUrgency.class);
        restartDeadlines.put(OsUpdateUrgency.CRITICAL_SECURITY, OsUpdateRestartDeadline.builder()
                .focusDays(1).softDays(5).hardDays(7).build());
        restartDeadlines.put(OsUpdateUrgency.QUALITY, OsUpdateRestartDeadline.builder()
                .focusDays(5).softDays(21).hardDays(30).build());
        osUpdatePolicy = OsUpdatePolicy.builder()
                .id("policy-1").rolloutRules(rolloutRules).restartDeadlines(restartDeadlines).build();
        osUpdate = OsUpdate.builder()
                .platform(OsPlatform.WINDOWS)
                .identifier("update-1")
                .classification(OsUpdateClassification.SECURITY)
                .severity(OsUpdateSeverity.CRITICAL)
                .publishedAt(PUBLISHED_AT)
                .firstSeenAt(DISCOVERED_AT)
                .build();
        deviceOsPendingUpdate = DeviceOsPendingUpdate.builder()
                .tenantId("tenant-1")
                .machineId("machine-1")
                .platform(OsPlatform.WINDOWS)
                .identifier("update-1")
                .discoveredAt(DISCOVERED_AT)
                .build();
    }

    @Test
    void calculate_deviceOutsideThePilotRing_installFromAfterBothDaysAndDeadlinesFromIt() {
        // execution
        Optional<DeviceOsUpdateRolloutState> calculated = deviceOsUpdateRolloutStateCalculator.calculate(
                osUpdatePolicy, false, osUpdate, deviceOsPendingUpdate, Optional.empty());

        // verifications
        assertThat(calculated).contains(DeviceOsUpdateRolloutState.builder()
                .tenantId("tenant-1")
                .machineId("machine-1")
                .platform(OsPlatform.WINDOWS)
                .identifier("update-1")
                .policyId("policy-1")
                .installFrom(Instant.parse("2026-10-17T17:00:00Z"))
                .focusAt(Instant.parse("2026-10-18T17:00:00Z"))
                .softAt(Instant.parse("2026-10-22T17:00:00Z"))
                .hardAt(Instant.parse("2026-10-24T17:00:00Z"))
                .build());
    }

    @Test
    void calculate_pilotDevice_installFromAfterTheFirstDays() {
        // execution
        Optional<DeviceOsUpdateRolloutState> calculated = deviceOsUpdateRolloutStateCalculator.calculate(
                osUpdatePolicy, true, osUpdate, deviceOsPendingUpdate, Optional.empty());

        // verifications
        assertThat(calculated).get().extracting(DeviceOsUpdateRolloutState::getInstallFrom)
                .isEqualTo(Instant.parse("2026-10-14T17:00:00Z"));
    }

    @Test
    void calculate_updateTheVendorDidNotDate_daysRunFromTheFirstReportInTheTenant() {
        // setup
        osUpdate.setPublishedAt(null);

        // execution
        Optional<DeviceOsUpdateRolloutState> calculated = deviceOsUpdateRolloutStateCalculator.calculate(
                osUpdatePolicy, true, osUpdate, deviceOsPendingUpdate, Optional.empty());

        // verifications
        assertThat(calculated).get().extracting(DeviceOsUpdateRolloutState::getInstallFrom)
                .isEqualTo(Instant.parse("2026-10-14T20:00:00Z"));
    }

    @Test
    void calculate_ruleOnHold_storedWithoutAnyDate() {
        // setup
        osUpdate.setClassification(OsUpdateClassification.QUALITY);

        // execution
        Optional<DeviceOsUpdateRolloutState> calculated = deviceOsUpdateRolloutStateCalculator.calculate(
                osUpdatePolicy, true, osUpdate, deviceOsPendingUpdate, Optional.empty());

        // verifications
        assertThat(calculated).contains(DeviceOsUpdateRolloutState.builder()
                .tenantId("tenant-1")
                .machineId("machine-1")
                .platform(OsPlatform.WINDOWS)
                .identifier("update-1")
                .policyId("policy-1")
                .build());
    }

    @Test
    void calculate_ruleOnHoldApprovedByATechnician_installFromTheApprovalAndDeadlinesFromIt() {
        // setup
        osUpdate.setClassification(OsUpdateClassification.QUALITY);
        OsUpdateOverride approval = OsUpdateOverride.builder()
                .action(OsUpdateOverrideAction.APPROVE).actedAt(Instant.parse("2026-10-20T09:00:00Z")).build();

        // execution
        Optional<DeviceOsUpdateRolloutState> calculated = deviceOsUpdateRolloutStateCalculator.calculate(
                osUpdatePolicy, false, osUpdate, deviceOsPendingUpdate, Optional.of(approval));

        // verifications
        assertThat(calculated).get().satisfies(deviceOsUpdateRolloutState -> {
            assertThat(deviceOsUpdateRolloutState.getOverrideAction()).isEqualTo(OsUpdateOverrideAction.APPROVE);
            assertThat(deviceOsUpdateRolloutState.getInstallFrom()).isEqualTo(Instant.parse("2026-10-20T09:00:00Z"));
            assertThat(deviceOsUpdateRolloutState.getHardAt()).isEqualTo(Instant.parse("2026-11-19T09:00:00Z"));
        });
    }

    @Test
    void calculate_approvedBeforeThePolicyAllowsIt_installFromTheApproval() {
        // setup
        OsUpdateOverride approval = OsUpdateOverride.builder()
                .action(OsUpdateOverrideAction.APPROVE).actedAt(Instant.parse("2026-10-14T09:00:00Z")).build();

        // execution
        Optional<DeviceOsUpdateRolloutState> calculated = deviceOsUpdateRolloutStateCalculator.calculate(
                osUpdatePolicy, false, osUpdate, deviceOsPendingUpdate, Optional.of(approval));

        // verifications
        assertThat(calculated).get().extracting(DeviceOsUpdateRolloutState::getInstallFrom)
                .isEqualTo(Instant.parse("2026-10-14T09:00:00Z"));
    }

    @Test
    void calculate_approvedAfterThePolicyAllowedIt_installFromStaysWhereThePolicyPutIt() {
        // setup
        OsUpdateOverride approval = OsUpdateOverride.builder()
                .action(OsUpdateOverrideAction.APPROVE).actedAt(Instant.parse("2026-10-25T09:00:00Z")).build();

        // execution
        Optional<DeviceOsUpdateRolloutState> calculated = deviceOsUpdateRolloutStateCalculator.calculate(
                osUpdatePolicy, false, osUpdate, deviceOsPendingUpdate, Optional.of(approval));

        // verifications
        assertThat(calculated).get().extracting(DeviceOsUpdateRolloutState::getInstallFrom)
                .isEqualTo(Instant.parse("2026-10-17T17:00:00Z"));
    }

    @ParameterizedTest
    @EnumSource(value = OsUpdateOverrideAction.class, names = {"HOLD", "REJECT"})
    void calculate_heldOrRejectedByATechnician_storedWithTheActionAndWithoutAnyDate(OsUpdateOverrideAction action) {
        // setup
        OsUpdateOverride osUpdateOverride = OsUpdateOverride.builder()
                .action(action).actedAt(Instant.parse("2026-10-14T09:00:00Z")).build();

        // execution
        Optional<DeviceOsUpdateRolloutState> calculated = deviceOsUpdateRolloutStateCalculator.calculate(
                osUpdatePolicy, false, osUpdate, deviceOsPendingUpdate, Optional.of(osUpdateOverride));

        // verifications
        assertThat(calculated).get().satisfies(deviceOsUpdateRolloutState -> {
            assertThat(deviceOsUpdateRolloutState.getOverrideAction()).isEqualTo(action);
            assertThat(deviceOsUpdateRolloutState.getInstallFrom()).isNull();
            assertThat(deviceOsUpdateRolloutState.getFocusAt()).isNull();
            assertThat(deviceOsUpdateRolloutState.getSoftAt()).isNull();
            assertThat(deviceOsUpdateRolloutState.getHardAt()).isNull();
        });
    }

    @Test
    void calculate_urgencyThePolicyHasNoRuleFor_empty() {
        // setup
        osUpdate.setSeverity(OsUpdateSeverity.IMPORTANT);

        // execution
        Optional<DeviceOsUpdateRolloutState> calculated = deviceOsUpdateRolloutStateCalculator.calculate(
                osUpdatePolicy, false, osUpdate, deviceOsPendingUpdate, Optional.empty());

        // verifications
        assertThat(calculated).isEmpty();
    }

    @Test
    void calculate_updateNoPolicyRollsOut_empty() {
        // setup
        osUpdate.setClassification(OsUpdateClassification.PREVIEW);

        // execution
        Optional<DeviceOsUpdateRolloutState> calculated = deviceOsUpdateRolloutStateCalculator.calculate(
                osUpdatePolicy, false, osUpdate, deviceOsPendingUpdate, Optional.empty());

        // verifications
        assertThat(calculated).isEmpty();
    }
}
