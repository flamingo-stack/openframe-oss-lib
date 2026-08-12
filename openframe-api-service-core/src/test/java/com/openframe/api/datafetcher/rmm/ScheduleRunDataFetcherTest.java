package com.openframe.api.datafetcher.rmm;

import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.openframe.api.dto.rmm.schedulerun.ScheduleRunResponse;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.api.mapper.GraphQLScheduleRunMapper;
import com.openframe.api.service.rmm.ScheduleRunFilterService;
import com.openframe.api.service.rmm.ScheduleRunService;
import org.dataloader.DataLoader;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScheduleRunDataFetcherTest {

    @Mock private ScheduleRunService scheduleRunService;
    @Mock private ScheduleRunFilterService scheduleRunFilterService;
    @Mock private GraphQLScheduleRunMapper mapper;

    @InjectMocks private ScheduleRunDataFetcher dataFetcher;

    @Test
    @DisplayName("initiator: a null initiatedBy (system-triggered fire) resolves to the synthetic SYSTEM user — UI shows SYSTEM, not \"Unknown user\"; no DataLoader interaction")
    void initiator_nullInitiatedBy_resolvesToSystemUser() throws Exception {
        DgsDataFetchingEnvironment dfe = mock(DgsDataFetchingEnvironment.class);
        doReturn(ScheduleRunResponse.builder().initiatedBy(null).build()).when(dfe).getSource();

        UserResponse result = dataFetcher.initiator(dfe).get();

        assertThat(result.getId()).isEqualTo(UserResponse.SYSTEM_ID);
        assertThat(result.getFirstName()).isEqualTo("SYSTEM");
        verify(dfe, never()).getDataLoader(any(String.class));
        verifyNoInteractions(scheduleRunService);
    }

    @Test
    @DisplayName("initiator: a user-triggered fire resolves the real user via the userDataLoader")
    void initiator_withUser_loadsRealUser() throws Exception {
        DgsDataFetchingEnvironment dfe = mock(DgsDataFetchingEnvironment.class);
        doReturn(ScheduleRunResponse.builder().initiatedBy("u-9").build()).when(dfe).getSource();
        @SuppressWarnings("unchecked")
        DataLoader<String, UserResponse> loader = mock(DataLoader.class);
        when(loader.load("u-9")).thenReturn(
                CompletableFuture.completedFuture(UserResponse.builder().id("u-9").firstName("Trinity").build()));
        doReturn(loader).when(dfe).getDataLoader("userDataLoader");

        UserResponse result = dataFetcher.initiator(dfe).get();

        assertThat(result.getFirstName()).isEqualTo("Trinity");
    }
}
