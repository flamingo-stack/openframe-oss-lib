package com.openframe.api.datafetcher.rmm;

import com.openframe.api.dto.rmm.software.AdoptSoftwareInput;
import com.openframe.api.service.rmm.software.SoftwareInstallUpdateManagementService;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.graphql.relay.InvalidRelayIdException;
import com.openframe.graphql.relay.NodeType;
import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareInstallUpdatedDataFetcherTest {

    private static final String MACHINE_ID = "m1";
    private static final String OTHER_MACHINE_ID = "m2";
    private static final String PACKAGE_NAME = "Google.Chrome";

    @Mock private SoftwareInstallUpdateManagementService softwareInstallUpdateManagementService;
    @Spy private RelayIdCodec relayIdCodec = new RelayIdCodec();

    @Captor private ArgumentCaptor<AdoptSoftwareInput> inputCaptor;

    @InjectMocks private SoftwareInstallUpdatedDataFetcher dataFetcher;

    private String machineGlobalId;
    private String otherMachineGlobalId;

    @BeforeEach
    void setUp() {
        machineGlobalId = relayIdCodec.encode(NodeType.MACHINE, MACHINE_ID);
        otherMachineGlobalId = relayIdCodec.encode(NodeType.MACHINE, OTHER_MACHINE_ID);
    }

    @Test
    void adoptSoftware_machineGlobalIds_serviceGetsThePlainIdsAndTheOrderedDevicesComeBackAsGlobalIds() {
        // setup
        AdoptSoftwareInput input = input(List.of(machineGlobalId, otherMachineGlobalId));
        when(softwareInstallUpdateManagementService.adopt(input)).thenReturn(List.of(MACHINE_ID));

        // execution
        List<String> ordered = dataFetcher.adoptSoftware(input);

        // verifications
        verify(softwareInstallUpdateManagementService).adopt(inputCaptor.capture());
        assertThat(inputCaptor.getValue())
                .extracting(AdoptSoftwareInput::getPackageManager, AdoptSoftwareInput::getPackageName,
                        AdoptSoftwareInput::getMachineIds)
                .containsExactly(PackageManagerType.WINGET, PACKAGE_NAME, List.of(MACHINE_ID, OTHER_MACHINE_ID));
        assertThat(ordered).containsExactly(machineGlobalId);
    }

    @Test
    void adoptSoftware_idOfAnotherNodeType_rejectedBeforeTheService() {
        // setup
        String organizationGlobalId = relayIdCodec.encode(NodeType.ORGANIZATION, "org-1");
        AdoptSoftwareInput input = input(List.of(organizationGlobalId));

        // execution
        InvalidRelayIdException rejected = assertThrows(InvalidRelayIdException.class, () -> dataFetcher.adoptSoftware(input));

        // verifications
        assertThat(rejected.getMessage()).isEqualTo("Expected a Machine id, got Organization");
        verifyNoInteractions(softwareInstallUpdateManagementService);
    }

    private static AdoptSoftwareInput input(List<String> machineIds) {
        AdoptSoftwareInput input = new AdoptSoftwareInput();
        input.setPackageManager(PackageManagerType.WINGET);
        input.setPackageName(PACKAGE_NAME);
        input.setMachineIds(machineIds);
        return input;
    }
}
