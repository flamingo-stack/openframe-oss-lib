package com.openframe.api.dataloader;

import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceCounts;
import com.openframe.api.service.rmm.osupdate.OsUpdateQueryService;
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

    @Mock private OsUpdateQueryService osUpdateQueryService;

    @InjectMocks private OsUpdateDeviceCountsDataLoader dataLoader;

    @Test
    void load_severalUpdates_countsInTheOrderOfTheIdsAndZeroesForAnIdTheServiceDoesNotKnow() {
        // setup
        List<String> osUpdateIds = List.of("id-2", "unknown", "id-1");
        OsUpdateDeviceCounts countsOfOne = OsUpdateDeviceCounts.builder().pendingDeviceCount(7).build();
        OsUpdateDeviceCounts countsOfTwo = OsUpdateDeviceCounts.builder().installedDeviceCount(3).build();
        when(osUpdateQueryService.countDevices(osUpdateIds)).thenReturn(Map.of("id-1", countsOfOne, "id-2", countsOfTwo));

        // execution
        CompletionStage<List<OsUpdateDeviceCounts>> loaded = dataLoader.load(osUpdateIds);

        // verifications
        assertThat(loaded).isCompletedWithValue(List.of(countsOfTwo, OsUpdateDeviceCounts.NONE, countsOfOne));
    }
}
