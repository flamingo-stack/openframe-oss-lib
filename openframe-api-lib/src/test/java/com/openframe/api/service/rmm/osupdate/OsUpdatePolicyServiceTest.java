package com.openframe.api.service.rmm.osupdate;

import com.openframe.api.dto.rmm.osupdate.OsUpdatePolicyCommand;
import com.openframe.api.dto.rmm.osupdate.OsUpdatePolicyResponse;
import com.openframe.api.exception.OsUpdatePolicyConflictException;
import com.openframe.api.exception.OsUpdatePolicyNotFoundException;
import com.openframe.api.mapper.OsUpdatePolicyResponseMapper;
import com.openframe.api.service.device.DeviceService;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicy;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicyTarget;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicyTargetType;
import com.openframe.data.document.rmm.osupdate.OsUpdateRestartDeadline;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutMode;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutRule;
import com.openframe.data.document.rmm.osupdate.OsUpdateUrgency;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.osupdate.OsUpdatePolicyRepository;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.osupdate.DeviceOsUpdateRolloutStateService;
import com.openframe.data.service.rmm.osupdate.OsUpdatePolicyResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OsUpdatePolicyServiceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final Instant CREATED_AT = Instant.parse("2026-10-01T00:00:00Z");

    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private OsUpdatePolicyRepository osUpdatePolicyRepository;
    @Mock private OsUpdatePolicyValidator osUpdatePolicyValidator;
    @Mock private DeviceOsUpdateRolloutStateService deviceOsUpdateRolloutStateService;
    @Mock private DeviceOsStateService deviceOsStateService;
    @Mock private DeviceService deviceService;
    @Mock private MachineRepository machineRepository;
    @Mock private TagAssignmentRepository tagAssignmentRepository;
    @Captor private ArgumentCaptor<OsUpdatePolicy> savedOsUpdatePolicy;

    private OsUpdatePolicyService osUpdatePolicyService;
    private OsUpdatePolicy tenantPolicy;
    private OsUpdatePolicy tagPolicy;
    private OsUpdatePolicyCommand command;

    @BeforeEach
    void setUp() {
        osUpdatePolicyService = new OsUpdatePolicyService(tenantIdProvider, osUpdatePolicyRepository,
                osUpdatePolicyValidator, new OsUpdatePolicyResponseMapper(), new OsUpdatePolicyResolver(),
                deviceOsUpdateRolloutStateService, deviceOsStateService, deviceService, machineRepository,
                tagAssignmentRepository);
        tenantPolicy = policy("policy-tenant", "Default",
                OsUpdatePolicyTarget.builder().type(OsUpdatePolicyTargetType.TENANT).build());
        tagPolicy = policy("policy-tag", "Kiosks", OsUpdatePolicyTarget.builder()
                .type(OsUpdatePolicyTargetType.DEVICE_TAG).tagIds(List.of("tag-kiosk")).build());
        command = OsUpdatePolicyCommand.builder()
                .name("Servers")
                .target(OsUpdatePolicyTarget.builder()
                        .type(OsUpdatePolicyTargetType.CUSTOMER).organizationId("org-1").build())
                .rolloutRules(Map.of(OsUpdateUrgency.QUALITY,
                        OsUpdateRolloutRule.builder().mode(OsUpdateRolloutMode.HOLD).build()))
                .restartDeadlines(Map.of(OsUpdateUrgency.QUALITY,
                        OsUpdateRestartDeadline.builder().focusDays(1).softDays(5).hardDays(7).build()))
                .build();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdatePolicyRepository.findByTenantIdOrderByCreatedAtAsc(TENANT_ID))
                .thenReturn(List.of(tenantPolicy, tagPolicy));
        when(osUpdatePolicyRepository.findByTenantIdAndId(TENANT_ID, "policy-tag")).thenReturn(Optional.of(tagPolicy));
        when(osUpdatePolicyRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void createPolicy_validCommand_savesItForTheTenantAndRefreshesTheRollout() {
        // execution
        OsUpdatePolicyResponse created = osUpdatePolicyService.createPolicy(command);

        // verifications
        verify(osUpdatePolicyValidator).validate(command, List.of(tenantPolicy, tagPolicy));
        verify(osUpdatePolicyRepository).save(savedOsUpdatePolicy.capture());
        assertThat(savedOsUpdatePolicy.getValue().getTenantId()).isEqualTo(TENANT_ID);
        assertThat(savedOsUpdatePolicy.getValue().getCreatedAt()).isNotNull()
                .isEqualTo(savedOsUpdatePolicy.getValue().getUpdatedAt());
        assertThat(created.getName()).isEqualTo("Servers");
        assertThat(created.getTarget()).isEqualTo(command.getTarget());
        verify(deviceOsUpdateRolloutStateService).refreshAll();
    }

    @Test
    void createPolicy_refusedByTheValidator_savesNothing() {
        // setup
        doThrow(new OsUpdatePolicyConflictException("conflict")).when(osUpdatePolicyValidator).validate(any(), any());

        // execution, verifications
        assertThatThrownBy(() -> osUpdatePolicyService.createPolicy(command))
                .isInstanceOf(OsUpdatePolicyConflictException.class);
        verify(osUpdatePolicyRepository, never()).save(any());
        verify(deviceOsUpdateRolloutStateService, never()).refreshAll();
    }

    @Test
    void updatePolicy_existingPolicy_validatedAgainstTheOthersAndKeepsItsCreationTime() {
        // execution
        OsUpdatePolicyResponse updated = osUpdatePolicyService.updatePolicy("policy-tag", command);

        // verifications
        verify(osUpdatePolicyValidator).validate(command, List.of(tenantPolicy));
        assertThat(updated.getId()).isEqualTo("policy-tag");
        assertThat(updated.getName()).isEqualTo("Servers");
        assertThat(updated.getCreatedAt()).isEqualTo(CREATED_AT);
        assertThat(updated.getUpdatedAt()).isAfter(CREATED_AT);
        verify(deviceOsUpdateRolloutStateService).refreshAll();
    }

    @Test
    void updatePolicy_unknownId_throwsNotFound() {
        // execution, verifications
        assertThatThrownBy(() -> osUpdatePolicyService.updatePolicy("policy-x", command))
                .isInstanceOf(OsUpdatePolicyNotFoundException.class);
    }

    @Test
    void deletePolicy_existingPolicy_deletesItAndRefreshesTheRollout() {
        // execution
        osUpdatePolicyService.deletePolicy("policy-tag");

        // verifications
        verify(osUpdatePolicyRepository).delete(tagPolicy);
        verify(deviceOsUpdateRolloutStateService).refreshAll();
    }

    @Test
    void findPolicyOfDevice_deviceWithTheTagOfATagPolicy_thatPolicyNotTheTenantOne() {
        // setup
        Machine machine = new Machine();
        machine.setMachineId("machine-1");
        machine.setOrganizationId("org-1");
        when(machineRepository.findByTenantIdAndMachineId(TENANT_ID, "machine-1")).thenReturn(Optional.of(machine));
        when(tagAssignmentRepository.findByEntityIdAndEntityType("machine-1", TagEntityType.DEVICE))
                .thenReturn(List.of(TagAssignment.builder().entityId("machine-1").tagId("tag-kiosk").build()));

        // execution
        Optional<OsUpdatePolicyResponse> found = osUpdatePolicyService.findPolicyOfDevice("machine-1");

        // verifications
        assertThat(found).map(OsUpdatePolicyResponse::getId).contains("policy-tag");
    }

    @Test
    void findPolicyOfDevice_deviceWeCannotManage_empty() {
        // setup
        when(deviceOsStateService.isNotManageable("machine-1")).thenReturn(true);

        // execution
        Optional<OsUpdatePolicyResponse> found = osUpdatePolicyService.findPolicyOfDevice("machine-1");

        // verifications
        assertThat(found).isEmpty();
        verify(deviceService).verifyExists("machine-1");
    }

    private static OsUpdatePolicy policy(String id, String name, OsUpdatePolicyTarget target) {
        return OsUpdatePolicy.builder()
                .id(id).tenantId(TENANT_ID).name(name).target(target)
                .rolloutRules(Map.of()).restartDeadlines(Map.of())
                .createdAt(CREATED_AT).updatedAt(CREATED_AT)
                .build();
    }
}
