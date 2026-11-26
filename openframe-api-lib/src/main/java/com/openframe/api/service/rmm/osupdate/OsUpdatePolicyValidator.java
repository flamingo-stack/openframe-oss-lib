package com.openframe.api.service.rmm.osupdate;

import com.openframe.api.dto.rmm.osupdate.OsUpdatePolicyCommand;
import com.openframe.api.exception.OsUpdatePolicyConflictException;
import com.openframe.core.exception.ValidationException;
import com.openframe.data.document.rmm.osupdate.OsUpdateDeferOption;
import com.openframe.data.document.rmm.osupdate.OsUpdateDeviceClass;
import com.openframe.data.document.rmm.osupdate.OsUpdateMaintenanceWindow;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicy;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicyTarget;
import com.openframe.data.document.rmm.osupdate.OsUpdateRestartDeadline;
import com.openframe.data.document.rmm.osupdate.OsUpdateRestartDialog;
import com.openframe.data.document.rmm.osupdate.OsUpdateRestartMode;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutMode;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutRule;
import com.openframe.data.document.rmm.osupdate.OsUpdateUrgency;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.util.CollectionUtils;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

@Component
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@RequiredArgsConstructor
public class OsUpdatePolicyValidator {

    private static final Pattern TIME_OF_DAY = Pattern.compile("([01]\\d|2[0-3]):[0-5]\\d");

    private final TagAssignmentRepository tagAssignmentRepository;

    // A policy is refused when a device would be covered by it and by another policy of the same target type:
    // nobody could say which of the two applies.
    public void validate(OsUpdatePolicyCommand osUpdatePolicyCommand,
                         Collection<OsUpdatePolicy> otherOsUpdatePolicies) {
        List<ValidationException.FieldError> fieldErrors = new ArrayList<>();
        validateName(osUpdatePolicyCommand, fieldErrors);
        validateTarget(osUpdatePolicyCommand.getTarget(), fieldErrors);
        validateRolloutRules(osUpdatePolicyCommand, fieldErrors);
        validateRestartDeadlines(osUpdatePolicyCommand, fieldErrors);
        validateMaintenanceWindows(osUpdatePolicyCommand, fieldErrors);
        validateRestartModes(osUpdatePolicyCommand, fieldErrors);
        validateDeviceRules(osUpdatePolicyCommand, fieldErrors);
        validateRestartDialog(osUpdatePolicyCommand.getRestartDialog(), fieldErrors);
        if (!fieldErrors.isEmpty()) {
            throw new ValidationException("OS update policy is not valid", fieldErrors);
        }
        otherOsUpdatePolicies.stream()
                .filter(other -> other.getTarget().getType() == osUpdatePolicyCommand.getTarget().getType())
                .map(other -> findConflict(osUpdatePolicyCommand.getTarget(), other))
                .flatMap(Optional::stream)
                .findFirst()
                .ifPresent(conflict -> {
                    throw new OsUpdatePolicyConflictException(conflict);
                });
    }

    private void validateName(OsUpdatePolicyCommand osUpdatePolicyCommand,
                              List<ValidationException.FieldError> fieldErrors) {
        if (StringUtils.isBlank(osUpdatePolicyCommand.getName())) {
            fieldErrors.add(new ValidationException.FieldError("name", "must not be blank"));
        }
    }

    private void validateTarget(OsUpdatePolicyTarget target, List<ValidationException.FieldError> fieldErrors) {
        if (target == null || target.getType() == null) {
            fieldErrors.add(new ValidationException.FieldError("target.type", "must be set"));
            return;
        }
        switch (target.getType()) {
            case CUSTOMER -> {
                if (StringUtils.isBlank(target.getOrganizationId())) {
                    fieldErrors.add(new ValidationException.FieldError(
                            "target.organizationId", "must be set for a CUSTOMER target"));
                }
            }
            case DEVICE_TAG -> {
                if (CollectionUtils.isEmpty(target.getTagIds())) {
                    fieldErrors.add(new ValidationException.FieldError(
                            "target.tagIds", "must not be empty for a DEVICE_TAG target"));
                }
            }
            case DEVICE -> {
                if (CollectionUtils.isEmpty(target.getMachineIds())) {
                    fieldErrors.add(new ValidationException.FieldError(
                            "target.machineIds", "must not be empty for a DEVICE target"));
                }
            }
            case TENANT -> {
            }
        }
    }

    private void validateRolloutRules(OsUpdatePolicyCommand osUpdatePolicyCommand,
                                      List<ValidationException.FieldError> fieldErrors) {
        if (CollectionUtils.isEmpty(osUpdatePolicyCommand.getRolloutRules())) {
            fieldErrors.add(new ValidationException.FieldError("rolloutRules", "must not be empty"));
            return;
        }
        boolean hasPilotRule = osUpdatePolicyCommand.getRolloutRules().values().stream()
                .map(OsUpdateRolloutRule::getMode)
                .anyMatch(OsUpdateRolloutMode.PILOT_THEN_EVERYONE::equals);
        if (hasPilotRule && StringUtils.isBlank(osUpdatePolicyCommand.getPilotTagId())) {
            fieldErrors.add(new ValidationException.FieldError(
                    "pilotTagId", "must be set when a rule uses PILOT_THEN_EVERYONE"));
        }
        osUpdatePolicyCommand.getRolloutRules().forEach((urgency, osUpdateRolloutRule) ->
                validateRolloutRule(urgency, osUpdateRolloutRule, fieldErrors));
    }

    private void validateRolloutRule(OsUpdateUrgency urgency, OsUpdateRolloutRule osUpdateRolloutRule,
                                     List<ValidationException.FieldError> fieldErrors) {
        String field = "rolloutRules." + urgency;
        if (osUpdateRolloutRule.getMode() == null) {
            fieldErrors.add(new ValidationException.FieldError(field + ".mode", "must be set"));
            return;
        }
        if (osUpdateRolloutRule.getMode() != OsUpdateRolloutMode.HOLD
                && isNegativeOrMissing(osUpdateRolloutRule.getDaysAfterRelease())) {
            fieldErrors.add(new ValidationException.FieldError(field + ".daysAfterRelease", "must be 0 or more"));
        }
        if (osUpdateRolloutRule.getMode() == OsUpdateRolloutMode.PILOT_THEN_EVERYONE
                && isNegativeOrMissing(osUpdateRolloutRule.getDaysLaterToEveryone())) {
            fieldErrors.add(new ValidationException.FieldError(field + ".daysLaterToEveryone", "must be 0 or more"));
        }
    }

    // Every urgency the policy rolls out needs its restart deadlines, in the order focus, soft, hard.
    private void validateRestartDeadlines(OsUpdatePolicyCommand osUpdatePolicyCommand,
                                          List<ValidationException.FieldError> fieldErrors) {
        Map<OsUpdateUrgency, OsUpdateRolloutRule> rolloutRules =
                Optional.ofNullable(osUpdatePolicyCommand.getRolloutRules()).orElse(Map.of());
        Map<OsUpdateUrgency, OsUpdateRestartDeadline> restartDeadlines =
                Optional.ofNullable(osUpdatePolicyCommand.getRestartDeadlines()).orElse(Map.of());
        for (OsUpdateUrgency urgency : rolloutRules.keySet()) {
            String field = "restartDeadlines." + urgency;
            OsUpdateRestartDeadline osUpdateRestartDeadline = restartDeadlines.get(urgency);
            if (osUpdateRestartDeadline == null) {
                fieldErrors.add(new ValidationException.FieldError(field, "must be set"));
            } else if (hasMissingOrDecreasingDays(osUpdateRestartDeadline)) {
                fieldErrors.add(new ValidationException.FieldError(
                        field, "focusDays, softDays and hardDays must be 0 or more and must not decrease"));
            }
        }
    }

    private boolean hasMissingOrDecreasingDays(OsUpdateRestartDeadline osUpdateRestartDeadline) {
        return isNegativeOrMissing(osUpdateRestartDeadline.getFocusDays())
                || isNegativeOrMissing(osUpdateRestartDeadline.getSoftDays())
                || isNegativeOrMissing(osUpdateRestartDeadline.getHardDays())
                || osUpdateRestartDeadline.getFocusDays() > osUpdateRestartDeadline.getSoftDays()
                || osUpdateRestartDeadline.getSoftDays() > osUpdateRestartDeadline.getHardDays();
    }

    private void validateMaintenanceWindows(OsUpdatePolicyCommand osUpdatePolicyCommand,
                                            List<ValidationException.FieldError> fieldErrors) {
        Map<OsUpdateDeviceClass, OsUpdateMaintenanceWindow> maintenanceWindows =
                Optional.ofNullable(osUpdatePolicyCommand.getMaintenanceWindows()).orElse(Map.of());
        for (OsUpdateDeviceClass deviceClass : OsUpdateDeviceClass.values()) {
            String field = "maintenanceWindows." + deviceClass;
            OsUpdateMaintenanceWindow osUpdateMaintenanceWindow = maintenanceWindows.get(deviceClass);
            if (osUpdateMaintenanceWindow == null) {
                fieldErrors.add(new ValidationException.FieldError(field, "must be set"));
            } else {
                validateMaintenanceWindow(field, osUpdateMaintenanceWindow, fieldErrors);
            }
        }
    }

    private void validateMaintenanceWindow(String field, OsUpdateMaintenanceWindow osUpdateMaintenanceWindow,
                                           List<ValidationException.FieldError> fieldErrors) {
        if (CollectionUtils.isEmpty(osUpdateMaintenanceWindow.getDaysOfWeek())) {
            fieldErrors.add(new ValidationException.FieldError(field + ".daysOfWeek", "must not be empty"));
        }
        if (isNotTimeOfDay(osUpdateMaintenanceWindow.getFromTime())) {
            fieldErrors.add(new ValidationException.FieldError(field + ".fromTime", "must be a time as HH:mm"));
        }
        if (isNotTimeOfDay(osUpdateMaintenanceWindow.getToTime())) {
            fieldErrors.add(new ValidationException.FieldError(field + ".toTime", "must be a time as HH:mm"));
        } else if (osUpdateMaintenanceWindow.getToTime().equals(osUpdateMaintenanceWindow.getFromTime())) {
            fieldErrors.add(new ValidationException.FieldError(field + ".toTime", "must differ from fromTime"));
        }
    }

    private boolean isNotTimeOfDay(String time) {
        return time == null || !TIME_OF_DAY.matcher(time).matches();
    }

    private void validateRestartModes(OsUpdatePolicyCommand osUpdatePolicyCommand,
                                      List<ValidationException.FieldError> fieldErrors) {
        Map<OsUpdateDeviceClass, OsUpdateRestartMode> restartModes =
                Optional.ofNullable(osUpdatePolicyCommand.getRestartModes()).orElse(Map.of());
        for (OsUpdateDeviceClass deviceClass : OsUpdateDeviceClass.values()) {
            if (restartModes.get(deviceClass) == null) {
                fieldErrors.add(new ValidationException.FieldError("restartModes." + deviceClass, "must be set"));
            }
        }
        if (restartModes.get(OsUpdateDeviceClass.SERVER) == OsUpdateRestartMode.DIALOG_THEN_DEADLINES) {
            fieldErrors.add(new ValidationException.FieldError(
                    "restartModes." + OsUpdateDeviceClass.SERVER, "a server cannot use DIALOG_THEN_DEADLINES"));
        }
    }

    private void validateDeviceRules(OsUpdatePolicyCommand osUpdatePolicyCommand,
                                     List<ValidationException.FieldError> fieldErrors) {
        if (osUpdatePolicyCommand.getOfflineRule() == null) {
            fieldErrors.add(new ValidationException.FieldError("offlineRule", "must be set"));
        }
        if (osUpdatePolicyCommand.getInUseRule() == null) {
            fieldErrors.add(new ValidationException.FieldError("inUseRule", "must be set"));
        }
    }

    private void validateRestartDialog(OsUpdateRestartDialog osUpdateRestartDialog,
                                       List<ValidationException.FieldError> fieldErrors) {
        if (osUpdateRestartDialog == null) {
            fieldErrors.add(new ValidationException.FieldError("restartDialog", "must be set"));
            return;
        }
        if (osUpdateRestartDialog.getAutoAnswerMinutes() == null || osUpdateRestartDialog.getAutoAnswerMinutes() < 1) {
            fieldErrors.add(new ValidationException.FieldError("restartDialog.autoAnswerMinutes", "must be 1 or more"));
        }
        if (hasRepeatedDeferOption(osUpdateRestartDialog)) {
            fieldErrors.add(new ValidationException.FieldError(
                    "restartDialog.deferOptions", "must not list an option twice"));
        }
    }

    private boolean hasRepeatedDeferOption(OsUpdateRestartDialog osUpdateRestartDialog) {
        List<OsUpdateDeferOption> deferOptions =
                Optional.ofNullable(osUpdateRestartDialog.getDeferOptions()).orElse(List.of());
        return deferOptions.stream().distinct().count() < deferOptions.size();
    }

    private boolean isNegativeOrMissing(Integer days) {
        return days == null || days < 0;
    }

    private Optional<String> findConflict(OsUpdatePolicyTarget target, OsUpdatePolicy other) {
        OsUpdatePolicyTarget otherTarget = other.getTarget();
        return switch (target.getType()) {
            case TENANT -> Optional.of("The tenant already has the policy '%s'".formatted(other.getName()));
            case CUSTOMER -> target.getOrganizationId().equals(otherTarget.getOrganizationId())
                    ? Optional.of("The customer already has the policy '%s'".formatted(other.getName()))
                    : Optional.empty();
            case DEVICE -> {
                List<String> sharedMachineIds = target.getMachineIds().stream()
                        .filter(otherTarget.getMachineIds()::contains)
                        .toList();
                yield sharedMachineIds.isEmpty()
                        ? Optional.empty()
                        : Optional.of("The policy '%s' already names the devices %s"
                                .formatted(other.getName(), sharedMachineIds));
            }
            case DEVICE_TAG -> findTagConflict(target, other);
        };
    }

    private boolean hasSharedTag(List<String> tagIds, List<String> otherTagIds) {
        return tagIds.stream().anyMatch(otherTagIds::contains);
    }

    private Optional<String> findTagConflict(OsUpdatePolicyTarget target, OsUpdatePolicy other) {
        List<String> otherTagIds = other.getTarget().getTagIds();
        if (hasSharedTag(target.getTagIds(), otherTagIds)) {
            return Optional.of("The policy '%s' already covers one of the tags".formatted(other.getName()));
        }
        List<String> taggedMachineIds = tagAssignmentRepository
                .findByTagIdInAndEntityType(target.getTagIds(), TagEntityType.DEVICE).stream()
                .map(TagAssignment::getEntityId)
                .distinct()
                .toList();
        if (taggedMachineIds.isEmpty()) {
            return Optional.empty();
        }
        List<String> machineIdsOfBoth = tagAssignmentRepository
                .findByEntityIdInAndTagIdInAndEntityType(taggedMachineIds, otherTagIds, TagEntityType.DEVICE).stream()
                .map(TagAssignment::getEntityId)
                .distinct()
                .toList();
        return machineIdsOfBoth.isEmpty()
                ? Optional.empty()
                : Optional.of("The devices %s also carry a tag of the policy '%s'"
                        .formatted(machineIdsOfBoth, other.getName()));
    }
}
