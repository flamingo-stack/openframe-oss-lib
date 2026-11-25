package com.openframe.api.datafetcher.rmm;

import com.openframe.api.dto.rmm.software.SoftwareDispatchResult;
import com.openframe.api.dto.rmm.software.SoftwareManagementInput;
import com.openframe.api.dto.rmm.software.SoftwarePackageInput;
import com.openframe.api.service.rmm.software.SoftwareInstallUpdateManagementService;
import com.openframe.audit.AuditAspect;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditExpressions;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.aop.aspectj.annotation.AspectJProxyFactory;

import java.util.List;
import java.util.Map;

import static com.openframe.data.document.packagesearch.PackageManagerType.BREW;
import static com.openframe.data.document.packagesearch.PackageManagerType.WINGET;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class SoftwareInstallUpdatedDataFetcherAuditTest {

    private static final List<String> MACHINE_IDS = List.of("m1", "m2");
    private static final List<SoftwareDispatchResult> FIREFOX_SENT = List.of(SoftwareDispatchResult.builder()
            .packageManager(WINGET).packageName("Mozilla.Firefox").executionId("exec-1").build());

    @Mock private SoftwareInstallUpdateManagementService softwareInstallUpdateManagementService;
    @Mock private AuditedMethodRunner auditedMethodRunner;
    @InjectMocks private SoftwareInstallUpdatedDataFetcher dataFetcher;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;

    @Test
    void installSoftware_refused_keepsTheAskedDevicesAndEachPackageByNameOrElseSoftwareId() {
        audited().installSoftware(halfResolvedInput());

        assertThat(capturedCall().detailsFromResult().apply(null)).containsExactlyInAnyOrderEntriesOf(Map.of(
                "machineIds", MACHINE_IDS, "packages", List.of("Mozilla.Firefox", "sw-2")));
    }

    @Test
    void updateSoftware_refused_keepsTheAskedDevicesAndEachPackageByNameOrElseSoftwareId() {
        audited().updateSoftware(halfResolvedInput());

        assertThat(capturedCall().detailsFromResult().apply(null)).containsExactlyInAnyOrderEntriesOf(Map.of(
                "machineIds", MACHINE_IDS, "packages", List.of("Mozilla.Firefox", "sw-2")));
    }

    @Test
    void installSoftware_onePackageSkipped_listsOnlyTheSentPackage() {
        audited().installSoftware(firefoxForWindowsAndMacInput());

        assertThat(capturedCall().detailsFromResult().apply(FIREFOX_SENT))
                .containsEntry("packages", List.of("Mozilla.Firefox"));
    }

    @Test
    void updateSoftware_onePackageSkipped_listsOnlyTheSentPackage() {
        audited().updateSoftware(firefoxForWindowsAndMacInput());

        assertThat(capturedCall().detailsFromResult().apply(FIREFOX_SENT))
                .containsEntry("packages", List.of("Mozilla.Firefox"));
    }

    @Test
    void installSoftware_nothingSent_isNotStored() {
        audited().installSoftware(firefoxForWindowsAndMacInput());

        assertThat(capturedCall().storeIf().test(List.of())).isFalse();
    }

    @Test
    void updateSoftware_nothingSent_isNotStored() {
        audited().updateSoftware(firefoxForWindowsAndMacInput());

        assertThat(capturedCall().storeIf().test(List.of())).isFalse();
    }

    @Test
    void installSoftware_oneDevice_targetsThatDevice() {
        audited().installSoftware(oneDeviceInput());

        assertThat(capturedCall().targetIdBeforeCall().get()).isEqualTo("m1");
    }

    @Test
    void installSoftware_severalDevices_targetsNoDevice() {
        audited().installSoftware(firefoxForWindowsAndMacInput());

        assertThat(capturedCall().targetIdBeforeCall().get()).isNull();
    }

    @Test
    void updateSoftware_oneDevice_targetsThatDevice() {
        audited().updateSoftware(oneDeviceInput());

        assertThat(capturedCall().targetIdBeforeCall().get()).isEqualTo("m1");
    }

    @Test
    void updateSoftware_severalDevices_targetsNoDevice() {
        audited().updateSoftware(firefoxForWindowsAndMacInput());

        assertThat(capturedCall().targetIdBeforeCall().get()).isNull();
    }

    private SoftwareInstallUpdatedDataFetcher audited() {
        AspectJProxyFactory proxyFactory = new AspectJProxyFactory(dataFetcher);
        proxyFactory.addAspect(new AuditAspect(auditedMethodRunner, new AuditExpressions(new RelayIdCodec())));
        return proxyFactory.getProxy();
    }

    private AuditCall capturedCall() {
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }

    private static SoftwareManagementInput halfResolvedInput() {
        return input(packageOf(WINGET, "Mozilla.Firefox", "sw-1"), packageOf(null, null, "sw-2"));
    }

    private static SoftwareManagementInput firefoxForWindowsAndMacInput() {
        return input(packageOf(WINGET, "Mozilla.Firefox", null), packageOf(BREW, "firefox", null));
    }

    private static SoftwareManagementInput oneDeviceInput() {
        SoftwareManagementInput input = firefoxForWindowsAndMacInput();
        input.setMachineIds(List.of("m1"));
        return input;
    }

    private static SoftwareManagementInput input(SoftwarePackageInput... packages) {
        SoftwareManagementInput input = new SoftwareManagementInput();
        input.setMachineIds(MACHINE_IDS);
        input.setPackages(List.of(packages));
        return input;
    }

    private static SoftwarePackageInput packageOf(PackageManagerType packageManager, String packageName,
                                                  String softwareId) {
        SoftwarePackageInput selection = new SoftwarePackageInput();
        selection.setPackageManager(packageManager);
        selection.setPackageName(packageName);
        selection.setSoftwareId(softwareId);
        return selection;
    }
}
