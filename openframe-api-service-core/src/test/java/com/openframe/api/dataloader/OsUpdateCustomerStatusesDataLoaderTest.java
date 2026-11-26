package com.openframe.api.dataloader;

import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceScope;
import com.openframe.api.service.rmm.osupdate.OsUpdateService;
import com.openframe.data.document.rmm.osupdate.OsUpdateCustomerStatus;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletionStage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OsUpdateCustomerStatusesDataLoaderTest {

    @Mock private OsUpdateService osUpdateService;

    @InjectMocks private OsUpdateCustomerStatusesDataLoader dataLoader;

    @Test
    void load_severalUpdates_statusesInTheOrderOfTheKeysAndNoneForAnUpdateWithoutCustomers() {
        // setup
        List<String> osUpdateIds = List.of("id-2", "no-customers", "id-1");
        List<OsUpdateCustomerStatus> statusesOfOne = List.of(OsUpdateCustomerStatus.HELD);
        List<OsUpdateCustomerStatus> statusesOfTwo =
                List.of(OsUpdateCustomerStatus.PILOT, OsUpdateCustomerStatus.APPROVED);
        when(osUpdateService.findCustomerStatuses(osUpdateIds, OsUpdateDeviceScope.EVERY_DEVICE))
                .thenReturn(Map.of("id-1", statusesOfOne, "id-2", statusesOfTwo));

        // execution
        CompletionStage<List<List<OsUpdateCustomerStatus>>> loaded = dataLoader.load(List.of(
                key("id-2", OsUpdateDeviceScope.EVERY_DEVICE), key("no-customers", OsUpdateDeviceScope.EVERY_DEVICE),
                key("id-1", OsUpdateDeviceScope.EVERY_DEVICE)));

        // verifications
        assertThat(loaded).isCompletedWithValue(List.of(statusesOfTwo, List.of(), statusesOfOne));
    }

    @Test
    void load_keysOfTwoDeviceScopes_onceReadPerScope() {
        // setup
        OsUpdateDeviceScope organizationDevices = new OsUpdateDeviceScope(List.of("machine-1"));
        List<OsUpdateCustomerStatus> statusesOfAll =
                List.of(OsUpdateCustomerStatus.APPROVED, OsUpdateCustomerStatus.REJECTED);
        List<OsUpdateCustomerStatus> statusesOfOrganization = List.of(OsUpdateCustomerStatus.REJECTED);
        when(osUpdateService.findCustomerStatuses(List.of("id-1"), OsUpdateDeviceScope.EVERY_DEVICE))
                .thenReturn(Map.of("id-1", statusesOfAll));
        when(osUpdateService.findCustomerStatuses(List.of("id-1"), organizationDevices))
                .thenReturn(Map.of("id-1", statusesOfOrganization));

        // execution
        CompletionStage<List<List<OsUpdateCustomerStatus>>> loaded = dataLoader.load(
                List.of(key("id-1", organizationDevices), key("id-1", OsUpdateDeviceScope.EVERY_DEVICE)));

        // verifications
        assertThat(loaded).isCompletedWithValue(List.of(statusesOfOrganization, statusesOfAll));
    }

    private static OsUpdateDeviceCountsKey key(String osUpdateId, OsUpdateDeviceScope osUpdateDeviceScope) {
        return OsUpdateDeviceCountsKey.builder().osUpdateId(osUpdateId).osUpdateDeviceScope(osUpdateDeviceScope).build();
    }
}
