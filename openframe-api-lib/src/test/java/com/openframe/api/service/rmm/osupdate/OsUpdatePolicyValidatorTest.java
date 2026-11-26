package com.openframe.api.service.rmm.osupdate;

import com.openframe.api.dto.rmm.osupdate.OsUpdatePolicyCommand;
import com.openframe.api.exception.OsUpdatePolicyConflictException;
import com.openframe.core.exception.ValidationException;
import com.openframe.data.document.rmm.osupdate.OsUpdateDeferOption;
import com.openframe.data.document.rmm.osupdate.OsUpdateDeviceClass;
import com.openframe.data.document.rmm.osupdate.OsUpdateInUseRule;
import com.openframe.data.document.rmm.osupdate.OsUpdateMaintenanceWindow;
import com.openframe.data.document.rmm.osupdate.OsUpdateOfflineRule;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicy;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicyTarget;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicyTargetType;
import com.openframe.data.document.rmm.osupdate.OsUpdateRestartDeadline;
import com.openframe.data.document.rmm.osupdate.OsUpdateRestartDialog;
import com.openframe.data.document.rmm.osupdate.OsUpdateRestartMode;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutMode;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutRule;
import com.openframe.data.document.rmm.osupdate.OsUpdateUrgency;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.DayOfWeek;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.InstanceOfAssertFactories.type;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OsUpdatePolicyValidatorTest {

    @Mock private TagAssignmentRepository tagAssignmentRepository;

    @InjectMocks private OsUpdatePolicyValidator osUpdatePolicyValidator;

    private OsUpdatePolicyCommand.OsUpdatePolicyCommandBuilder command;

    @BeforeEach
    void setUp() {
        command = OsUpdatePolicyCommand.builder()
                .name("Default")
                .target(target(OsUpdatePolicyTargetType.TENANT).build())
                .rolloutRules(Map.of(OsUpdateUrgency.QUALITY, OsUpdateRolloutRule.builder()
                        .mode(OsUpdateRolloutMode.EVERYONE_AT_ONCE).daysAfterRelease(7).build()))
                .restartDeadlines(Map.of(OsUpdateUrgency.QUALITY, OsUpdateRestartDeadline.builder()
                        .focusDays(1).softDays(5).hardDays(7).build()))
                .maintenanceWindows(Map.of(
                        OsUpdateDeviceClass.WORKSTATION, window("01:00", "04:00").build(),
                        OsUpdateDeviceClass.SERVER, window("03:00", "06:00").build()))
                .offlineRule(OsUpdateOfflineRule.WAIT_FOR_NEXT_WINDOW)
                .inUseRule(OsUpdateInUseRule.SKIP_WINDOW)
                .restartModes(Map.of(
                        OsUpdateDeviceClass.WORKSTATION, OsUpdateRestartMode.DIALOG_THEN_DEADLINES,
                        OsUpdateDeviceClass.SERVER, OsUpdateRestartMode.MAINTENANCE_WINDOW_ONLY))
                .restartDialog(restartDialog().build());
    }

    @Test
    void validate_tenantPolicyWithNoOtherPolicy_passes() {
        // execution, verifications
        assertThatCode(() -> osUpdatePolicyValidator.validate(command.build(), List.of())).doesNotThrowAnyException();
    }

    @Test
    void validate_blankNameAndCustomerTargetWithoutCustomer_namesBothFields() {
        // setup
        command.name(" ").target(target(OsUpdatePolicyTargetType.CUSTOMER).build());

        // execution, verifications
        assertFieldErrors("name", "target.organizationId");
    }

    @Test
    void validate_tagTargetWithoutTagsAndDeviceTargetWithoutDevices_nameTheirFields() {
        // setup
        command.target(target(OsUpdatePolicyTargetType.DEVICE_TAG).build());

        // execution, verifications
        assertFieldErrors("target.tagIds");
        command.target(target(OsUpdatePolicyTargetType.DEVICE).build());
        assertFieldErrors("target.machineIds");
    }

    @Test
    void validate_pilotRuleWithoutItsDaysAndWithoutAPilotTag_namesTheThree() {
        // setup
        command.rolloutRules(Map.of(OsUpdateUrgency.QUALITY,
                OsUpdateRolloutRule.builder().mode(OsUpdateRolloutMode.PILOT_THEN_EVERYONE).build()));

        // execution, verifications
        assertFieldErrors("pilotTagId", "rolloutRules.QUALITY.daysAfterRelease",
                "rolloutRules.QUALITY.daysLaterToEveryone");
    }

    @Test
    void validate_holdRuleWithoutDays_passes() {
        // setup
        command.rolloutRules(Map.of(OsUpdateUrgency.QUALITY,
                OsUpdateRolloutRule.builder().mode(OsUpdateRolloutMode.HOLD).build()));

        // execution, verifications
        assertThatCode(() -> osUpdatePolicyValidator.validate(command.build(), List.of())).doesNotThrowAnyException();
    }

    @Test
    void validate_rolloutRuleWithoutRestartDeadlines_namesTheUrgency() {
        // setup
        command.restartDeadlines(Map.of());

        // execution, verifications
        assertFieldErrors("restartDeadlines.QUALITY");
    }

    @Test
    void validate_softDeadlineAfterTheHardOne_namesTheUrgency() {
        // setup
        command.restartDeadlines(Map.of(OsUpdateUrgency.QUALITY,
                OsUpdateRestartDeadline.builder().focusDays(1).softDays(9).hardDays(7).build()));

        // execution, verifications
        assertFieldErrors("restartDeadlines.QUALITY");
    }

    @Test
    void validate_zeroDaysAndEqualRestartDeadlines_passes() {
        // setup
        command.pilotTagId("tag-pilot")
                .rolloutRules(Map.of(OsUpdateUrgency.QUALITY, OsUpdateRolloutRule.builder()
                        .mode(OsUpdateRolloutMode.PILOT_THEN_EVERYONE).daysAfterRelease(0).daysLaterToEveryone(0)
                        .build()))
                .restartDeadlines(Map.of(OsUpdateUrgency.QUALITY,
                        OsUpdateRestartDeadline.builder().focusDays(0).softDays(0).hardDays(0).build()));

        // execution, verifications
        assertThatCode(() -> osUpdatePolicyValidator.validate(command.build(), List.of())).doesNotThrowAnyException();
    }

    @Test
    void validate_negativeDays_nameTheirFields() {
        // setup
        command.pilotTagId("tag-pilot")
                .rolloutRules(Map.of(OsUpdateUrgency.QUALITY, OsUpdateRolloutRule.builder()
                        .mode(OsUpdateRolloutMode.PILOT_THEN_EVERYONE).daysAfterRelease(-1).daysLaterToEveryone(-1)
                        .build()))
                .restartDeadlines(Map.of(OsUpdateUrgency.QUALITY,
                        OsUpdateRestartDeadline.builder().focusDays(-1).softDays(5).hardDays(7).build()));

        // execution, verifications
        assertFieldErrors("rolloutRules.QUALITY.daysAfterRelease", "rolloutRules.QUALITY.daysLaterToEveryone",
                "restartDeadlines.QUALITY");
    }

    @Test
    void validate_focusDeadlineAfterTheSoftOne_namesTheUrgency() {
        // setup
        command.restartDeadlines(Map.of(OsUpdateUrgency.QUALITY,
                OsUpdateRestartDeadline.builder().focusDays(6).softDays(5).hardDays(7).build()));

        // execution, verifications
        assertFieldErrors("restartDeadlines.QUALITY");
    }

    @Test
    void validate_tenantPolicyNextToPoliciesOfOtherTargetTypes_passes() {
        // setup
        List<OsUpdatePolicy> others = List.of(
                policy("Northwind", target(OsUpdatePolicyTargetType.CUSTOMER).organizationId("org-1").build()),
                policy("Imaging PCs", target(OsUpdatePolicyTargetType.DEVICE).machineIds(List.of("m-1")).build()));

        // execution, verifications
        assertThatCode(() -> osUpdatePolicyValidator.validate(command.build(), others)).doesNotThrowAnyException();
    }

    @Test
    void validate_noWindowOfTheServersAndNoRestartModeOfTheWorkstations_nameTheDeviceClasses() {
        // setup
        command.maintenanceWindows(Map.of(OsUpdateDeviceClass.WORKSTATION, window("01:00", "04:00").build()))
                .restartModes(Map.of(OsUpdateDeviceClass.SERVER, OsUpdateRestartMode.NEVER));

        // execution, verifications
        assertFieldErrors("maintenanceWindows.SERVER", "restartModes.WORKSTATION");
    }

    @Test
    void validate_noWindowsAndNoRestartModesAtAll_nameBothDeviceClassesOfBoth() {
        // setup
        command.maintenanceWindows(null).restartModes(null);

        // execution, verifications
        assertFieldErrors("maintenanceWindows.WORKSTATION", "maintenanceWindows.SERVER",
                "restartModes.WORKSTATION", "restartModes.SERVER");
    }

    @Test
    void validate_windowWithoutDaysAndWithTheSameStartAndEnd_namesBothFields() {
        // setup
        command.maintenanceWindows(Map.of(
                OsUpdateDeviceClass.WORKSTATION, window("01:00", "01:00").daysOfWeek(List.of()).build(),
                OsUpdateDeviceClass.SERVER, window("03:00", "06:00").build()));

        // execution, verifications
        assertFieldErrors("maintenanceWindows.WORKSTATION.daysOfWeek", "maintenanceWindows.WORKSTATION.toTime");
    }

    @ParameterizedTest
    @ValueSource(strings = {"24:00", "1:00", "01:60", "01:00:00", "night"})
    void validate_windowTimeThatIsNotATimeOfDay_namesTheField(String time) {
        // setup
        command.maintenanceWindows(Map.of(
                OsUpdateDeviceClass.WORKSTATION, window(time, "04:00").build(),
                OsUpdateDeviceClass.SERVER, window("03:00", time).build()));

        // execution, verifications
        assertFieldErrors("maintenanceWindows.WORKSTATION.fromTime", "maintenanceWindows.SERVER.toTime");
    }

    @Test
    void validate_windowWithoutItsTimes_namesBoth() {
        // setup
        command.maintenanceWindows(Map.of(
                OsUpdateDeviceClass.WORKSTATION, window(null, null).build(),
                OsUpdateDeviceClass.SERVER, window("03:00", "06:00").build()));

        // execution, verifications
        assertFieldErrors("maintenanceWindows.WORKSTATION.fromTime", "maintenanceWindows.WORKSTATION.toTime");
    }

    @Test
    void validate_windowOverMidnightAndTheLastMinuteOfTheDay_passes() {
        // setup
        command.maintenanceWindows(Map.of(
                OsUpdateDeviceClass.WORKSTATION, window("22:00", "02:00").build(),
                OsUpdateDeviceClass.SERVER, window("00:00", "23:59").build()));

        // execution, verifications
        assertThatCode(() -> osUpdatePolicyValidator.validate(command.build(), List.of())).doesNotThrowAnyException();
    }

    @Test
    void validate_serversUnderTheDialogMode_namesTheServers() {
        // setup
        command.restartModes(Map.of(
                OsUpdateDeviceClass.WORKSTATION, OsUpdateRestartMode.DIALOG_THEN_DEADLINES,
                OsUpdateDeviceClass.SERVER, OsUpdateRestartMode.DIALOG_THEN_DEADLINES));

        // execution, verifications
        assertFieldErrors("restartModes.SERVER");
    }

    @Test
    void validate_noOfflineRuleNoInUseRuleAndNoRestartDialog_namesTheThree() {
        // setup
        command.offlineRule(null).inUseRule(null).restartDialog(null);

        // execution, verifications
        assertFieldErrors("offlineRule", "inUseRule", "restartDialog");
    }

    @Test
    void validate_dialogThatAnswersItselfAtOnceAndListsADeferOptionTwice_namesBothFields() {
        // setup
        command.restartDialog(restartDialog().autoAnswerMinutes(0)
                .deferOptions(List.of(OsUpdateDeferOption.ONE_HOUR, OsUpdateDeferOption.ONE_HOUR)).build());

        // execution, verifications
        assertFieldErrors("restartDialog.autoAnswerMinutes", "restartDialog.deferOptions");
        command.restartDialog(restartDialog().autoAnswerMinutes(null).build());
        assertFieldErrors("restartDialog.autoAnswerMinutes");
    }

    @Test
    void validate_dialogWithoutDeferralsThatAnswersItselfAfterOneMinute_passes() {
        // setup
        command.restartDialog(restartDialog().autoAnswerMinutes(1).deferOptions(List.of()).build());

        // execution, verifications
        assertThatCode(() -> osUpdatePolicyValidator.validate(command.build(), List.of())).doesNotThrowAnyException();
        command.restartDialog(restartDialog().deferOptions(null).build());
        assertThatCode(() -> osUpdatePolicyValidator.validate(command.build(), List.of())).doesNotThrowAnyException();
    }

    @Test
    void validate_secondTenantPolicy_conflictNamingTheFirst() {
        // setup
        OsUpdatePolicy other = policy("Everyone", target(OsUpdatePolicyTargetType.TENANT).build());

        // execution, verifications
        assertThatThrownBy(() -> osUpdatePolicyValidator.validate(command.build(), List.of(other)))
                .isInstanceOf(OsUpdatePolicyConflictException.class)
                .hasMessageContaining("Everyone");
    }

    @Test
    void validate_customerPolicies_conflictOnlyForTheSameCustomer() {
        // setup
        command.target(target(OsUpdatePolicyTargetType.CUSTOMER).organizationId("org-1").build());
        OsUpdatePolicy ofAnotherCustomer =
                policy("Acme", target(OsUpdatePolicyTargetType.CUSTOMER).organizationId("org-2").build());
        OsUpdatePolicy ofTheCustomer =
                policy("Northwind", target(OsUpdatePolicyTargetType.CUSTOMER).organizationId("org-1").build());

        // execution, verifications
        assertThatCode(() -> osUpdatePolicyValidator.validate(command.build(), List.of(ofAnotherCustomer)))
                .doesNotThrowAnyException();
        assertThatThrownBy(() -> osUpdatePolicyValidator.validate(command.build(), List.of(ofTheCustomer)))
                .isInstanceOf(OsUpdatePolicyConflictException.class)
                .hasMessageContaining("Northwind");
    }

    @Test
    void validate_devicePolicyNamingADeviceOfAnotherDevicePolicy_conflictNamingTheDevice() {
        // setup
        command.target(target(OsUpdatePolicyTargetType.DEVICE).machineIds(List.of("machine-1", "machine-2")).build());
        OsUpdatePolicy other =
                policy("Servers", target(OsUpdatePolicyTargetType.DEVICE).machineIds(List.of("machine-2")).build());

        // execution, verifications
        assertThatThrownBy(() -> osUpdatePolicyValidator.validate(command.build(), List.of(other)))
                .isInstanceOf(OsUpdatePolicyConflictException.class)
                .hasMessageContaining("Servers")
                .hasMessageContaining("machine-2")
                .hasMessageNotContaining("machine-1");
    }

    @Test
    void validate_tagPolicyWhoseDeviceCarriesATagOfAnotherTagPolicy_conflictNamingTheDevice() {
        // setup
        command.target(target(OsUpdatePolicyTargetType.DEVICE_TAG).tagIds(List.of("tag-a")).build());
        OsUpdatePolicy other =
                policy("Kiosks", target(OsUpdatePolicyTargetType.DEVICE_TAG).tagIds(List.of("tag-b")).build());
        when(tagAssignmentRepository.findByTagIdInAndEntityType(List.of("tag-a"), TagEntityType.DEVICE))
                .thenReturn(List.of(tagAssignment("machine-1", "tag-a"), tagAssignment("machine-2", "tag-a")));
        when(tagAssignmentRepository.findByEntityIdInAndTagIdInAndEntityType(
                List.of("machine-1", "machine-2"), List.of("tag-b"), TagEntityType.DEVICE))
                .thenReturn(List.of(tagAssignment("machine-2", "tag-b")));

        // execution, verifications
        assertThatThrownBy(() -> osUpdatePolicyValidator.validate(command.build(), List.of(other)))
                .isInstanceOf(OsUpdatePolicyConflictException.class)
                .hasMessageContaining("Kiosks")
                .hasMessageContaining("machine-2");
    }

    @Test
    void validate_tagPoliciesWhoseDevicesDoNotMeet_passes() {
        // setup
        command.target(target(OsUpdatePolicyTargetType.DEVICE_TAG).tagIds(List.of("tag-a")).build());
        OsUpdatePolicy other =
                policy("Kiosks", target(OsUpdatePolicyTargetType.DEVICE_TAG).tagIds(List.of("tag-b")).build());
        when(tagAssignmentRepository.findByTagIdInAndEntityType(List.of("tag-a"), TagEntityType.DEVICE))
                .thenReturn(List.of(tagAssignment("machine-1", "tag-a")));
        when(tagAssignmentRepository.findByEntityIdInAndTagIdInAndEntityType(
                List.of("machine-1"), List.of("tag-b"), TagEntityType.DEVICE)).thenReturn(List.of());

        // execution, verifications
        assertThatCode(() -> osUpdatePolicyValidator.validate(command.build(), List.of(other)))
                .doesNotThrowAnyException();
    }

    @Test
    void validate_tagPolicySharingATagWithAnotherTagPolicy_conflict() {
        // setup
        command.target(target(OsUpdatePolicyTargetType.DEVICE_TAG).tagIds(List.of("tag-a", "tag-b")).build());
        OsUpdatePolicy other =
                policy("Kiosks", target(OsUpdatePolicyTargetType.DEVICE_TAG).tagIds(List.of("tag-b")).build());

        // execution, verifications
        assertThatThrownBy(() -> osUpdatePolicyValidator.validate(command.build(), List.of(other)))
                .isInstanceOf(OsUpdatePolicyConflictException.class)
                .hasMessageContaining("Kiosks");
    }

    private void assertFieldErrors(String... fields) {
        assertThatThrownBy(() -> osUpdatePolicyValidator.validate(command.build(), List.of()))
                .asInstanceOf(type(ValidationException.class))
                .extracting(ValidationException::getFieldErrors)
                .satisfies(fieldErrors -> assertThat(fieldErrors)
                        .extracting(ValidationException.FieldError::field)
                        .containsExactlyInAnyOrder(fields));
    }

    private static OsUpdatePolicyTarget.OsUpdatePolicyTargetBuilder target(OsUpdatePolicyTargetType type) {
        return OsUpdatePolicyTarget.builder().type(type);
    }

    private static OsUpdateMaintenanceWindow.OsUpdateMaintenanceWindowBuilder window(String fromTime, String toTime) {
        return OsUpdateMaintenanceWindow.builder()
                .daysOfWeek(List.of(DayOfWeek.TUESDAY, DayOfWeek.THURSDAY)).fromTime(fromTime).toTime(toTime);
    }

    private static OsUpdateRestartDialog.OsUpdateRestartDialogBuilder restartDialog() {
        return OsUpdateRestartDialog.builder()
                .deferOptions(List.of(OsUpdateDeferOption.ONE_HOUR, OsUpdateDeferOption.FOUR_HOURS))
                .autoAnswerMinutes(60).userMayScheduleRestart(true);
    }

    private static OsUpdatePolicy policy(String name, OsUpdatePolicyTarget target) {
        return OsUpdatePolicy.builder().id(name).name(name).target(target).build();
    }

    private static TagAssignment tagAssignment(String machineId, String tagId) {
        return TagAssignment.builder().entityId(machineId).tagId(tagId).entityType(TagEntityType.DEVICE).build();
    }
}
