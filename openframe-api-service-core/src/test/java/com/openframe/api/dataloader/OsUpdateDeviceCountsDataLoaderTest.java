package com.openframe.api.dataloader;

import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceCounts;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceScope;
import com.openframe.api.service.rmm.osupdate.OsUpdateService;
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
class OsUpdateDeviceCountsDataLoaderTest {

    @Mock private OsUpdateService osUpdateService;

    @InjectMocks private OsUpdateDeviceCountsDataLoader dataLoader;

    @Test
    void load_severalUpdates_countsInTheOrderOfTheKeysAndZeroesForAnIdTheServiceDoesNotKnow() {
        // setup
        List<String> osUpdateIds = List.of("id-2", "unknown", "id-1");
        OsUpdateDeviceCounts countsOfOne = OsUpdateDeviceCounts.builder().pendingDeviceCount(7).build();
        OsUpdateDeviceCounts countsOfTwo = OsUpdateDeviceCounts.builder().installedDeviceCount(3).build();
        when(osUpdateService.countDevices(osUpdateIds, OsUpdateDeviceScope.EVERY_DEVICE))
                .thenReturn(Map.of("id-1", countsOfOne, "id-2", countsOfTwo));

        // execution
        CompletionStage<List<OsUpdateDeviceCounts>> loaded = dataLoader.load(List.of(
                key("id-2", OsUpdateDeviceScope.EVERY_DEVICE), key("unknown", OsUpdateDeviceScope.EVERY_DEVICE),
                key("id-1", OsUpdateDeviceScope.EVERY_DEVICE)));

        // verifications
        assertThat(loaded).isCompletedWithValue(List.of(countsOfTwo, OsUpdateDeviceCounts.NONE, countsOfOne));
    }

    @Test
    void load_keysOfTwoDeviceScopes_onceCountedPerScope() {
        // setup
        OsUpdateDeviceScope organizationDevices = new OsUpdateDeviceScope(List.of("machine-1"));
        OsUpdateDeviceCounts allCounts = OsUpdateDeviceCounts.builder().pendingDeviceCount(5).build();
        OsUpdateDeviceCounts organizationCounts = OsUpdateDeviceCounts.builder().pendingDeviceCount(1).build();
        when(osUpdateService.countDevices(List.of("id-1"), OsUpdateDeviceScope.EVERY_DEVICE)).thenReturn(Map.of("id-1", allCounts));
        when(osUpdateService.countDevices(List.of("id-1"), organizationDevices))
                .thenReturn(Map.of("id-1", organizationCounts));

        // execution
        CompletionStage<List<OsUpdateDeviceCounts>> loaded =
                dataLoader.load(List.of(key("id-1", organizationDevices), key("id-1", OsUpdateDeviceScope.EVERY_DEVICE)));

        // verifications
        assertThat(loaded).isCompletedWithValue(List.of(organizationCounts, allCounts));
    }

    private static OsUpdateDeviceCountsKey key(String osUpdateId, OsUpdateDeviceScope osUpdateDeviceScope) {
        return OsUpdateDeviceCountsKey.builder().osUpdateId(osUpdateId).osUpdateDeviceScope(osUpdateDeviceScope).build();
    }
}
